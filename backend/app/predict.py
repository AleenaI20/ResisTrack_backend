from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import joblib
import numpy as np

from app.models import (
    AntibioticPrediction,
    PredictMetaResponse,
    PredictRequest,
    PredictResponse,
)

SUPPORTED_SPECIES = "Klebsiella pneumoniae"
LAB_CONFIRMATION = (
    "Research prototype only. Confirm every result with standard laboratory "
    "testing and review by a trained healthcare or laboratory professional."
)
DEMO_MARKERS = (
    "KPC",
    "NDM",
    "OXA-48",
    "CTX-M",
    "SHV",
    "TEM",
    "IMP",
    "GES",
    "aacA4",
    "rmtB",
    "gyrA",
    "gyrB",
    "parC",
    "parE",
    "oqxA",
    "oqxB",
    "acrA",
    "acrB",
    "ompF",
    "ompC",
    "fosA",
    "dfrA",
    "tetA",
)


class PredictorError(RuntimeError):
    pass


class PredictorLoadError(PredictorError):
    pass


class UnsupportedOrganismError(PredictorError):
    pass


@dataclass(frozen=True)
class VectorizedFeatures:
    values: np.ndarray
    sources_by_column: dict[str, tuple[str, ...]]
    unmatched: tuple[str, ...]


def _canonical(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.casefold())


def _marker_variants(feature: str) -> list[str]:
    marker = feature.split(":", 1)[-1].strip()
    variants = [marker]

    if feature.startswith("mutation:"):
        variants.append(re.split(r"[_\s]", marker, maxsplit=1)[0])

    without_allele = re.sub(r"[-_]\d+(?:\.\d+)?(?:[-_].*)?$", "", marker)
    variants.append(without_allele)

    for value in tuple(variants):
        if value.casefold().startswith("bla") and len(value) > 3:
            variants.append(value[3:])
            variants.append(
                re.sub(r"[-_]\d+(?:\.\d+)?(?:[-_].*)?$", "", value[3:])
            )

    return list(dict.fromkeys(value for value in variants if value))


def _column_for_feature(
    feature: str,
    columns: tuple[str, ...],
) -> str | None:
    by_casefold = {column.casefold(): column for column in columns}
    by_canonical = {_canonical(column): column for column in columns}

    variants = _marker_variants(feature)
    for variant in variants:
        if match := by_casefold.get(variant.casefold()):
            return match
    for variant in variants:
        if match := by_canonical.get(_canonical(variant)):
            return match

    marker_key = _canonical(variants[0])
    family_columns = [
        column
        for column in columns
        if column.upper() == column
        and 3 <= len(_canonical(column)) <= 10
        and _canonical(column) in marker_key
    ]
    if family_columns:
        return max(family_columns, key=lambda column: len(_canonical(column)))
    return None


def vectorize_features(
    detected_features: dict[str, bool],
    columns: list[str] | tuple[str, ...],
) -> VectorizedFeatures:
    ordered_columns = tuple(columns)
    index_by_column = {
        column: index for index, column in enumerate(ordered_columns)
    }
    sources: dict[str, list[str]] = {}
    unmatched: list[str] = []
    values = np.zeros((1, len(ordered_columns)), dtype=np.float64)

    for feature, present in sorted(detected_features.items()):
        if not present:
            continue
        column = _column_for_feature(feature, ordered_columns)
        if column is None:
            unmatched.append(feature)
            continue
        values[0, index_by_column[column]] = 1.0
        sources.setdefault(column, []).append(feature)

    return VectorizedFeatures(
        values=values,
        sources_by_column={
            column: tuple(feature_names)
            for column, feature_names in sources.items()
        },
        unmatched=tuple(unmatched),
    )


class GenomeFirewallPredictor:
    def __init__(
        self,
        *,
        gene_columns: list[str],
        config: dict[str, dict[str, Any]],
        models: dict[str, Any],
        active_genes: dict[str, list[str]],
    ) -> None:
        self.gene_columns = tuple(gene_columns)
        self.config = config
        self.models = models
        self.active_genes = {
            drug: tuple(columns) for drug, columns in active_genes.items()
        }
        self._validate()

    @classmethod
    def load(cls, path: Path) -> "GenomeFirewallPredictor":
        if not path.is_file():
            raise PredictorLoadError(f"Model artifact was not found: {path}")
        try:
            bundle = joblib.load(path)
        except Exception as exc:
            raise PredictorLoadError(
                f"Model artifact could not be loaded: {exc}"
            ) from exc

        if not isinstance(bundle, dict):
            raise PredictorLoadError("Model artifact must contain a dictionary.")
        required = {"gene_cols", "config", "models", "active_genes"}
        missing = required.difference(bundle)
        if missing:
            raise PredictorLoadError(
                f"Model artifact is missing keys: {', '.join(sorted(missing))}"
            )
        return cls(
            gene_columns=bundle["gene_cols"],
            config=bundle["config"],
            models=bundle["models"],
            active_genes=bundle["active_genes"],
        )

    def _validate(self) -> None:
        drugs = set(self.models)
        if drugs != set(self.config) or drugs != set(self.active_genes):
            raise PredictorLoadError(
                "Model, config, and active-gene drug sets must match."
            )
        if len(self.gene_columns) != len(set(self.gene_columns)):
            raise PredictorLoadError("Global model feature names must be unique.")

        for drug, model in self.models.items():
            columns = self.active_genes[drug]
            if len(columns) != len(set(columns)):
                raise PredictorLoadError(
                    f"{drug} active feature names must be unique."
                )
            if not set(columns).issubset(self.gene_columns):
                raise PredictorLoadError(
                    f"{drug} contains unknown active feature names."
                )
            if getattr(model, "n_features_in_", None) != len(columns):
                raise PredictorLoadError(
                    f"{drug} expects {getattr(model, 'n_features_in_', '?')} "
                    f"features but active_genes defines {len(columns)}."
                )
            classes = list(getattr(model, "classes_", []))
            if 1 not in classes:
                raise PredictorLoadError(
                    f"{drug} model has no resistant class labelled 1."
                )

    def metadata(self) -> PredictMetaResponse:
        available = set(self.gene_columns)
        return PredictMetaResponse(
            supported_species=SUPPORTED_SPECIES,
            drugs=list(self.models),
            gene_columns=list(self.gene_columns),
            demo_markers=[
                marker for marker in DEMO_MARKERS if marker in available
            ],
        )

    @staticmethod
    def _validate_organism(organism: str | None) -> None:
        if not organism:
            return
        normalized = " ".join(organism.casefold().split())
        if "klebsiella pneumoniae" not in normalized:
            raise UnsupportedOrganismError(
                f"This model supports {SUPPORTED_SPECIES} only; received "
                f"{organism!r}."
            )

    def predict(self, payload: PredictRequest) -> PredictResponse:
        self._validate_organism(payload.organism)
        results: list[AntibioticPrediction] = []
        all_matched: set[str] = set()

        for drug, model in self.models.items():
            columns = self.active_genes[drug]
            vectorized = vectorize_features(
                payload.detected_features,
                columns,
            )
            all_matched.update(
                feature
                for values in vectorized.sources_by_column.values()
                for feature in values
            )

            classes = list(model.classes_)
            resistant_index = classes.index(1)
            probability = float(
                model.predict_proba(vectorized.values)[0, resistant_index]
            )
            drug_config = self.config[drug]
            tier = str(drug_config["tier"])
            margin = float(drug_config["margin"])
            model_call = self._call(probability, margin, tier)
            call, target_gate_status, call_reason = self._apply_target_gate(
                model_call,
                probability,
                margin,
                tier,
            )
            supporting = self._supporting_features(
                model,
                columns,
                vectorized.sources_by_column,
                call,
            )
            evidence = self._evidence_category(call, supporting)

            results.append(
                AntibioticPrediction(
                    drug=drug,
                    call=call,
                    confidence=max(probability, 1.0 - probability),
                    resistance_probability=probability,
                    evidence_category=evidence,
                    supporting_features=supporting,
                    model_tier=tier,
                    no_call_margin=margin,
                    target_gate_status=target_gate_status,
                    call_reason=call_reason,
                )
            )

        return PredictResponse(
            organism=payload.organism,
            supported_species=SUPPORTED_SPECIES,
            predictions=results,
            matched_features=sorted(all_matched),
            unmatched_features=sorted(
                feature
                for feature, present in payload.detected_features.items()
                if present and feature not in all_matched
            ),
            disclaimer=LAB_CONFIRMATION,
        )

    @staticmethod
    def _call(
        probability: float,
        margin: float,
        tier: str,
    ) -> Literal["likely_to_fail", "likely_to_work", "no_call"]:
        if tier.casefold() == "no-call":
            return "no_call"
        if probability >= 0.5 + margin:
            return "likely_to_fail"
        if probability <= 0.5 - margin:
            return "likely_to_work"
        return "no_call"

    @staticmethod
    def _apply_target_gate(
        model_call: Literal["likely_to_fail", "likely_to_work", "no_call"],
        probability: float,
        margin: float,
        tier: str,
    ) -> tuple[
        Literal["likely_to_fail", "likely_to_work", "no_call"],
        Literal[
            "not_required_for_fail_call",
            "not_confirmed",
            "not_evaluated",
        ],
        str,
    ]:
        if model_call == "likely_to_fail":
            return (
                model_call,
                "not_required_for_fail_call",
                "Resistance probability exceeded the drug-specific fail "
                "threshold.",
            )
        if model_call == "likely_to_work":
            return (
                "no_call",
                "not_confirmed",
                "The model favored susceptibility, but molecular-target "
                "presence cannot be confirmed from AMRFinderPlus resistance "
                "features, so the final result is no-call.",
            )
        if tier.casefold() == "no-call":
            reason = "This drug is configured as no-call for this model tier."
        else:
            reason = (
                f"Resistance probability {probability:.3f} is inside the "
                f"drug-specific no-call band around 0.5 (margin {margin:.2f})."
            )
        return "no_call", "not_evaluated", reason

    @staticmethod
    def _supporting_features(
        model: Any,
        columns: tuple[str, ...],
        sources_by_column: dict[str, tuple[str, ...]],
        call: str,
    ) -> list[str]:
        if call == "no_call" or not sources_by_column:
            return []

        coefficients = np.asarray(model.coef_)[0]
        desired_sign = 1 if call == "likely_to_fail" else -1
        ranked: list[tuple[float, str]] = []
        for index, column in enumerate(columns):
            if column not in sources_by_column:
                continue
            coefficient = float(coefficients[index])
            if coefficient * desired_sign <= 0:
                continue
            for source in sources_by_column[column]:
                ranked.append((abs(coefficient), source))
        ranked.sort(reverse=True)
        return [source for _, source in ranked[:5]]

    @staticmethod
    def _evidence_category(
        call: str,
        supporting_features: list[str],
    ) -> Literal[
        "known_resistance_marker",
        "statistical_association",
        "no_known_signal",
    ]:
        if call == "likely_to_fail" and supporting_features:
            return "known_resistance_marker"
        if supporting_features:
            return "statistical_association"
        return "no_known_signal"

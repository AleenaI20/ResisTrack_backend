from pathlib import Path

import numpy as np
import pytest

from app.models import PredictRequest
from app.predict import (
    GenomeFirewallPredictor,
    UnsupportedOrganismError,
    vectorize_features,
)


class FixedProbabilityModel:
    def __init__(
        self,
        probability: float,
        coefficients: list[float],
    ) -> None:
        self.probability = probability
        self.coef_ = np.asarray([coefficients], dtype=float)
        self.classes_ = np.asarray([0, 1])
        self.n_features_in_ = len(coefficients)

    def predict_proba(self, values: np.ndarray) -> np.ndarray:
        assert values.shape == (1, self.n_features_in_)
        return np.asarray([[1 - self.probability, self.probability]])


def build_predictor(
    probability: float = 0.9,
    *,
    tier: str = "Strong",
    margin: float = 0.15,
) -> GenomeFirewallPredictor:
    return GenomeFirewallPredictor(
        gene_columns=["KPC", "gyrA"],
        config={"meropenem": {"tier": tier, "margin": margin}},
        models={
            "meropenem": FixedProbabilityModel(
                probability,
                [2.0, -0.5],
            )
        },
        active_genes={"meropenem": ["KPC", "gyrA"]},
    )


def test_vectorize_features_maps_amrfinder_gene_and_mutation_names() -> None:
    result = vectorize_features(
        {
            "gene:blaKPC-2": True,
            "mutation:gyrA_S83L": True,
            "gene:unknown": True,
            "gene:ignored": False,
        },
        ["KPC", "gyrA"],
    )

    assert result.values.tolist() == [[1.0, 1.0]]
    assert result.sources_by_column == {
        "KPC": ("gene:blaKPC-2",),
        "gyrA": ("mutation:gyrA_S83L",),
    }
    assert result.unmatched == ("gene:unknown",)


def test_prediction_returns_fail_call_and_known_marker_evidence() -> None:
    response = build_predictor().predict(
        PredictRequest(
            detected_features={"gene:blaKPC-2": True},
            organism="Klebsiella pneumoniae",
        )
    )

    prediction = response.predictions[0]
    assert prediction.call == "likely_to_fail"
    assert prediction.resistance_probability == pytest.approx(0.9)
    assert prediction.confidence == pytest.approx(0.9)
    assert prediction.evidence_category == "known_resistance_marker"
    assert prediction.supporting_features == ["gene:blaKPC-2"]
    assert response.matched_features == ["gene:blaKPC-2"]
    assert "standard laboratory testing" in response.disclaimer


def test_prediction_uses_margin_and_no_call_tier() -> None:
    margin_response = build_predictor(probability=0.6).predict(
        PredictRequest(detected_features={})
    )
    tier_response = build_predictor(
        probability=0.99,
        tier="No-call",
        margin=0.4,
    ).predict(PredictRequest(detected_features={}))

    assert margin_response.predictions[0].call == "no_call"
    assert tier_response.predictions[0].call == "no_call"


def test_target_gate_turns_unconfirmed_work_call_into_no_call() -> None:
    response = build_predictor(probability=0.1).predict(
        PredictRequest(detected_features={"mutation:gyrA_S83L": True})
    )

    prediction = response.predictions[0]
    assert prediction.call == "no_call"
    assert prediction.target_gate_status == "not_confirmed"
    assert "molecular-target presence" in prediction.call_reason


def test_prediction_rejects_out_of_scope_organism() -> None:
    with pytest.raises(UnsupportedOrganismError):
        build_predictor().predict(
            PredictRequest(
                detected_features={},
                organism="Escherichia coli",
            )
        )


def test_real_artifact_has_consistent_per_drug_feature_shapes() -> None:
    artifact = (
        Path(__file__).resolve().parents[1] / "genome_firewall_models.pkl"
    )
    predictor = GenomeFirewallPredictor.load(artifact)

    assert len(predictor.gene_columns) == 231
    assert set(predictor.models) == {
        "meropenem",
        "gentamicin",
        "piperacillin/tazobactam",
        "ciprofloxacin",
        "ceftazidime",
    }
    for drug, model in predictor.models.items():
        assert model.n_features_in_ == len(predictor.active_genes[drug])

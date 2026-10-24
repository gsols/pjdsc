"""Explicit assumed hospital-choice shares; not observed patient preferences."""


def hospital_shares(order, policy="nearest"):
    if policy not in {"nearest", "nearest_three_equal"} or not order or len(set(order)) != len(order):
        raise ValueError("Invalid hospital-choice assumption or candidate ordering")
    chosen = order[:3] if policy == "nearest_three_equal" else order[:1]
    return [(ident, 1 / len(chosen)) for ident in chosen]

"""Continuous expected-patient transportation LP, not clinical referral/routing."""
import math
import numpy as np
from scipy.optimize import linprog
from scipy.sparse import coo_matrix


def transport_plan(demands, capacities, costs):
    n, m = len(demands), len(capacities)
    if not n or not m or len(costs) != n or any(len(row) != m for row in costs):
        raise ValueError("Invalid transportation dimensions")
    if any(not math.isfinite(v) or v < 0 for v in [*demands, *capacities, *(v for row in costs for v in row)]):
        raise ValueError("Invalid transportation value")
    total = min(sum(demands), sum(capacities))
    if total <= 0:
        return [[0.0] * m for _ in demands]
    indices = np.arange(n * m)
    constraints = coo_matrix((np.ones(2 * n * m),
        (np.concatenate([np.repeat(np.arange(n), m), n + np.tile(np.arange(m), n)]), np.concatenate([indices, indices]))),
        shape=(n + m, n * m)).tocsr()
    result = linprog(np.asarray(costs).ravel(), A_ub=constraints, b_ub=[*demands, *capacities],
        A_eq=coo_matrix(np.ones((1, n * m))).tocsr(), b_eq=[total], bounds=(0, None), method="highs",
        options={"primal_feasibility_tolerance": 1e-9, "dual_feasibility_tolerance": 1e-9})
    if not result.success:
        raise ValueError("Transportation optimization infeasible")
    return np.maximum(0, result.x.reshape(n, m)).tolist()


def daily_plan(groups, states, admission_rate, occupancy, day, activation_day):
    ids = [s["config"]["facilityId"] for s in states]
    demand = [g["cases"] * admission_rate for g in groups]
    support = [max(0, s["config"]["normalCapacity"] * (1 - occupancy)
        + (s["config"]["surgeCapacity"] if day >= activation_day else 0) - sum(c for _, c in s["cohorts"])) for s in states]
    costs = [[g["facilityCostsKm"][ident] for ident in ids] for g in groups]
    supported = transport_plan(demand, support, costs)
    remaining = [max(0, d - sum(row)) for d, row in zip(demand, supported)]
    holding = transport_plan(remaining, [max(0, s["config"]["holdingCapacity"] - s["holding"]) for s in states], costs)
    return [{"supported": dict(zip(ids, a)), "holding": dict(zip(ids, b))} for a, b in zip(supported, holding)]

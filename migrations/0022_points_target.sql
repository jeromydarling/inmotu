-- inmotu — drag track-points projection. Drag points are cumulative (every race
-- counts, unlike BMX best-8); the goal is hitting your track's points cutoff to
-- make the division team → Vegas. Reuses the per-race points log (bmx_scores,
-- a generic rider points store); adds the racer's season target.

ALTER TABLE riders ADD COLUMN points_target INTEGER; -- season points goal (e.g. division-team cutoff)

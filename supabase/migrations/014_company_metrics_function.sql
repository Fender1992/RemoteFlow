-- Function to calculate all company metrics in a single query per company
-- Eliminates the N+1 query problem in update-reputation cron

CREATE OR REPLACE FUNCTION calculate_company_metrics(p_company_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_jobs', COALESCE(total.cnt, 0),
    'jobs_filled', COALESCE(filled.cnt, 0),
    'jobs_expired', COALESCE(expired.cnt, 0),
    'jobs_ghosted', COALESCE(ghosted.cnt, 0),
    'avg_reposts_per_job', COALESCE(reposts.avg_repost, 1.0),
    'total_signals', COALESCE(signals.total_cnt, 0),
    'response_signals', COALESCE(signals.response_cnt, 0),
    'avg_time_to_fill_days', fill_times.avg_days,
    'median_time_to_fill_days', fill_times.median_days,
    'total_outcomes', COALESCE(outcomes.total_cnt, 0),
    'responses_received', COALESCE(outcomes.responses_cnt, 0),
    'interview_count', COALESCE(outcomes.interview_cnt, 0),
    'offer_count', COALESCE(outcomes.offer_cnt, 0),
    'evergreen_job_count', COALESCE(evergreen.cnt, 0),
    'recent_jobs', COALESCE(trend.recent_cnt, 0),
    'previous_jobs', COALESCE(trend.previous_cnt, 0)
  ) INTO result
  FROM
    -- Total jobs count
    (SELECT COUNT(*) AS cnt FROM jobs WHERE company_id = p_company_id) AS total,
    -- Filled jobs count
    (SELECT COUNT(*) AS cnt FROM jobs WHERE company_id = p_company_id AND status = 'closed_filled') AS filled,
    -- Expired jobs count
    (SELECT COUNT(*) AS cnt FROM jobs WHERE company_id = p_company_id AND status = 'closed_expired') AS expired,
    -- Ghosted jobs count
    (SELECT COUNT(*) AS cnt FROM jobs WHERE company_id = p_company_id AND ghost_score >= 5) AS ghosted,
    -- Average reposts per job
    (SELECT COALESCE(AVG(GREATEST(repost_count, 1)), 1.0) AS avg_repost FROM jobs WHERE company_id = p_company_id AND repost_count IS NOT NULL) AS reposts,
    -- Signal counts
    (SELECT
      COUNT(*) AS total_cnt,
      COUNT(*) FILTER (WHERE signal_type = 'response_received') AS response_cnt
     FROM job_signals WHERE company_id = p_company_id
    ) AS signals,
    -- Time to fill metrics
    (SELECT
      AVG(days_to_fill)::INTEGER AS avg_days,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_fill)::INTEGER AS median_days
     FROM jobs WHERE company_id = p_company_id AND lifecycle_status = 'filled' AND days_to_fill IS NOT NULL
    ) AS fill_times,
    -- Application outcome counts
    (SELECT
      COUNT(*) AS total_cnt,
      COUNT(*) FILTER (WHERE outcome != 'no_response') AS responses_cnt,
      COUNT(*) FILTER (WHERE outcome IN ('interview', 'offer', 'hired')) AS interview_cnt,
      COUNT(*) FILTER (WHERE outcome IN ('offer', 'hired')) AS offer_cnt
     FROM application_outcomes WHERE company_id = p_company_id
    ) AS outcomes,
    -- Evergreen jobs count
    (SELECT COUNT(*) AS cnt FROM jobs WHERE company_id = p_company_id AND is_evergreen = true) AS evergreen,
    -- Hiring trend (last 30d vs previous 30d)
    (SELECT
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS recent_cnt,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days') AS previous_cnt
     FROM jobs WHERE company_id = p_company_id
    ) AS trend;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

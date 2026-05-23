CREATE TYPE "public"."risk_appetite" AS ENUM('conservative', 'neutral', 'aggressive');--> statement-breakpoint
CREATE TYPE "public"."role_type" AS ENUM('operations', 'products', 'marketing', 'finance', 'brand', 'supply_chain', 'regional');--> statement-breakpoint
CREATE TYPE "public"."source_status" AS ENUM('active', 'pending_v2');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('internal', 'external');--> statement-breakpoint
CREATE TYPE "public"."decision_type" AS ENUM('selection', 'marketing', 'budget', 'operation', 'cross_border');--> statement-breakpoint
CREATE TYPE "public"."analysis_status" AS ENUM('running', 'paused_hitl', 'completed', 'failed', 'degraded_offline');--> statement-breakpoint
CREATE TYPE "public"."decision_status" AS ENUM('approved', 'deferred', 'rejected', 'need_more_data');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('proposal_create', 'proposal_update', 'proposal_soft_delete', 'analysis_start', 'analysis_complete', 'analysis_failed', 'hitl_pause', 'hitl_approve', 'hitl_edit', 'hitl_reject', 'rollback', 'persona_edit', 'persona_reset', 'decision_create', 'weight_override', 'raci_override', 'provider_degrade', 'reproducibility_run', 'evidence_search');--> statement-breakpoint
CREATE TYPE "public"."repro_verdict" AS ENUM('stable', 'partial', 'unstable');--> statement-breakpoint
CREATE TYPE "public"."degrade_reason" AS ENUM('timeout', 'rate_limit', 'server_error', 'quota_exhausted', 'manual', 'all_failed');--> statement-breakpoint
CREATE TYPE "public"."provider" AS ENUM('opus-4-7', 'sonnet-4-6', 'haiku-4-5', 'offline-rules');--> statement-breakpoint
CREATE TABLE "personas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_type" "role_type" NOT NULL,
	"name" text NOT NULL,
	"objective" text NOT NULL,
	"kpis" jsonb NOT NULL,
	"interest_boundary" text NOT NULL,
	"natural_conflicts" jsonb NOT NULL,
	"decision_catchphrase" text NOT NULL,
	"risk_appetite" "risk_appetite" NOT NULL,
	"notes" text DEFAULT '',
	"is_default" integer DEFAULT 1 NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "personas_role_type_unique" UNIQUE("role_type")
);
--> statement-breakpoint
CREATE TABLE "internal_objectives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"key_results" jsonb NOT NULL,
	"year" integer NOT NULL,
	"quarter" integer NOT NULL,
	"owner" text NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" "source_type" NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"owner" text NOT NULL,
	"status" "source_status" DEFAULT 'active' NOT NULL,
	"description" text,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"title" text NOT NULL,
	"snippet" text NOT NULL,
	"full_content" text NOT NULL,
	"embedding" jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cited_count" integer DEFAULT 0 NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"raw_text" text NOT NULL,
	"redacted_text" text NOT NULL,
	"decision_type" "decision_type" NOT NULL,
	"decision_type_confidence" integer NOT NULL,
	"declared_objective_id" uuid NOT NULL,
	"weight_overrides" jsonb,
	"selected_persona_ids" jsonb NOT NULL,
	"is_demo" integer DEFAULT 0 NOT NULL,
	"demo_scenario_id" text,
	"current_analysis_version_id" uuid,
	"deleted_at" timestamp with time zone,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analysis_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"version_label" text NOT NULL,
	"rollback_from_id" uuid,
	"status" "analysis_status" DEFAULT 'running' NOT NULL,
	"temperature" integer NOT NULL,
	"seed" integer NOT NULL,
	"structured_claims" jsonb,
	"l1_alignment_score" integer,
	"l1_alignment_warnings" jsonb,
	"recalled_evidence_ids" jsonb,
	"round_0_votes" jsonb,
	"round_1_votes" jsonb,
	"anchoring_flags" jsonb,
	"tws_scores_by_claim" jsonb,
	"effective_weights" jsonb,
	"premortem_risks" jsonb,
	"decision_report" jsonb,
	"headline_disagreement" text,
	"decision_report_overrides" jsonb,
	"methodology_ab_compare" jsonb,
	"total_duration_ms" integer,
	"provider_used" jsonb,
	"llm_call_count" integer,
	"input_hash" text NOT NULL,
	"output_hash" text,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"analysis_version_id" uuid NOT NULL,
	"prev_decision_id" uuid,
	"status" "decision_status" NOT NULL,
	"summary" text NOT NULL,
	"key_changes" jsonb NOT NULL,
	"attendees" jsonb NOT NULL,
	"meeting_date" timestamp with time zone NOT NULL,
	"affected_persona_ids" jsonb NOT NULL,
	"aar_expected" text,
	"aar_actual" text,
	"aar_gap_reason" text,
	"aar_next_improvement" text,
	"weight_suggestions" jsonb,
	"weight_suggestions_accepted" jsonb,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hitl_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_version_id" uuid NOT NULL,
	"thread_id" text NOT NULL,
	"node_id" text NOT NULL,
	"state_summary" text,
	"paused_at" timestamp with time zone NOT NULL,
	"resumed_at" timestamp with time zone,
	"resume_decision" text,
	"resume_reason" text,
	"edited_state_keys" jsonb,
	"auto_approve_at" timestamp with time zone,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" text DEFAULT 'anonymous' NOT NULL,
	"action" "audit_action" NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid,
	"input_hash" text,
	"output_hash" text,
	"metadata" jsonb,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reproducibility_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"run_count" integer DEFAULT 3 NOT NULL,
	"analysis_version_ids" jsonb NOT NULL,
	"temperatures" jsonb NOT NULL,
	"seeds" jsonb NOT NULL,
	"conclusion_consistency_pct" integer NOT NULL,
	"top3_jaccard" integer NOT NULL,
	"evidence_overlap_pct" integer NOT NULL,
	"verdict" "repro_verdict" NOT NULL,
	"total_duration_ms" integer NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_version_id" uuid,
	"from_provider" "provider" NOT NULL,
	"to_provider" "provider" NOT NULL,
	"reason" "degrade_reason" NOT NULL,
	"node_id" text,
	"error_message" text,
	"recovered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evidence_cards" ADD CONSTRAINT "evidence_cards_source_id_evidence_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."evidence_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_declared_objective_id_internal_objectives_id_fk" FOREIGN KEY ("declared_objective_id") REFERENCES "public"."internal_objectives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_versions" ADD CONSTRAINT "analysis_versions_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_analysis_version_id_analysis_versions_id_fk" FOREIGN KEY ("analysis_version_id") REFERENCES "public"."analysis_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hitl_audit" ADD CONSTRAINT "hitl_audit_analysis_version_id_analysis_versions_id_fk" FOREIGN KEY ("analysis_version_id") REFERENCES "public"."analysis_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reproducibility_runs" ADD CONSTRAINT "reproducibility_runs_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_events" ADD CONSTRAINT "provider_events_analysis_version_id_analysis_versions_id_fk" FOREIGN KEY ("analysis_version_id") REFERENCES "public"."analysis_versions"("id") ON DELETE no action ON UPDATE no action;
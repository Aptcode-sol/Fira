exactly whats the cause
# SKILL: RCA Finder
## Root Cause Analysis for Software Incidents, Repeated Failures, and Proactive Risk Assessment

```
SKILL VERSION : 1.0
CONTEXTS      : LIVE (incident in progress) /
                POST-MORTEM (incident over, investigation) /
                PROACTIVE (pre-incident risk scoring)
PURPOSE       : Identify root causes — not symptoms.
                Validate causal claims rigorously.
                Produce corrective and preventive actions
                that fix the system, not the individual.
TRIGGER       : User says "production is down", "why did this fail",
                "this bug keeps coming back", "postmortem for X",
                "what caused Y", or provides logs/traces/error reports.
```

---

## WHEN TO USE

Use when:
- Incident in progress and cause is unknown
- Incident resolved but cause not understood
- Same failure recurring after supposedly being fixed
- Team wants to understand why something broke before it happens again
- Postmortem is needed but team doesn't know where to start

Do NOT use:
- For pure debugging (just find and fix the specific bug) → use engineering:debug skill
- For testing strategy → use Testing Analyst skill
- For architecture review → use Architecture Analyst skill

DISTINCTION:
  Debugging answers:  "What is broken? How do we fix it?"
  RCA answers:        "Why was the system susceptible?
                       What sequence led to failure?
                       What must change so this cannot recur?"

---

## HOW TO RUN

```
Step 1:   Extract Incident Profile
Step 1.2: Set Context Gate   (LIVE / POST-MORTEM / PROACTIVE)
Step 1.4: Set System Gate    (MONOLITH / MICROSERVICES / AI-SYSTEM / MIXED)
Step 1.6: Set Incident Gate  (OUTAGE / PERFORMANCE / DATA-CORRUPTION /
                               SECURITY / REPEATED-BUG / RISK-ASSESSMENT)
Step 1.8: Assess evidence available
Step 1.9: Check applicability matrix
Then: run applicable checks → produce report
```

---

### Step 1 — Incident Profile

```
INCIDENT PROFILE:
  What happened:          (one sentence description of the observable failure)
  When:                   (start time, end time, duration)
  Who was affected:       (which users? which tenants? what operations?)
  Severity:               (SEV0 full outage / SEV1 partial / SEV2 degraded / SEV3 minor)
  Service(s) affected:    (which components / DAGs / endpoints / tables)
  System type:            (monolith / microservices / AI pipeline / mixed)
  Evidence available:     (logs? traces? metrics? deployment history? user reports?)
  Known trigger:          (deploy? cron job? traffic spike? third-party change? unknown)
  Has this happened before? (first occurrence or recurring?)
  Current status:         (active / mitigated / resolved)
```

---

### Step 1.2 — Context Gate

```
LIVE (incident in progress):
  Speed matters. Use COMPACT TRIBUNAL (Section 2).
  Evidence is incomplete. Hypotheses will be approximate.
  Goal: identify the most probable cause fast enough to mitigate.
  Do NOT: spend 2 hours building a perfect Fault Tree during an outage.
  DO: C3 Change Analysis first → C4 IS/IS NOT → COMPACT TRIBUNAL.
  Full RCA done POST-MORTEM after mitigation.

POST-MORTEM (incident resolved, investigation phase):
  Completeness matters. Use full check sequence.
  Evidence should be complete. Request missing evidence before starting.
  Goal: true root cause + systemic corrective actions.
  Culture requirement: blameless. What did the SYSTEM allow? Not who.
  Timeline: complete within 72 hours of incident resolution.

PROACTIVE (no incident yet):
  Use C13 FMEA only. Not the other checks.
  Goal: identify high-risk failure modes before they occur.
  Input: architecture diagrams, deployment patterns, known weak points.
  Output: Risk Priority Numbers per failure mode. Mitigation backlog.
```

---

### Step 1.4 — System Type Gate

```
MONOLITH:
  Failure likely within one service. Simpler blast radius.
  D1 distributed tracing: skip or limited.
  Focus: C3 change analysis, C5 5 Whys, C8 Swiss Cheese.

MICROSERVICES / DISTRIBUTED:
  Failure may cross service boundaries.
  D1 distributed tracing: CRITICAL. Run before C5-C7.
  Cascade failure common: circuit breaker analysis mandatory.
  C9 blast radius: more complex — map the dependency graph.

AI SYSTEM:
  Failure may not be binary (crash vs no crash).
  May be: gradual quality degradation, eval score drop, hallucination rate increase.
  A1 AI System RCA: run after C1-C4.
  Evidence includes eval suite results, RAGAS metrics, production samples.

MIXED:
  Identify which layer failed first.
  D1 for inter-service. A1 if AI pipeline involved.
  Map the dependency graph before starting hypothesis evaluation.
```

---

### Step 1.6 — Incident Type Gate

```
OUTAGE (service unavailable):
  First check: C3 Change Analysis. Most outages follow a deploy.
  Then: C4 IS/IS NOT (is it total or partial?)
  Then: D1 distributed tracing (which service died?)

PERFORMANCE DEGRADATION (slow but alive):
  First check: C2 Timeline (when did latency start rising?)
  Then: C3 Change Analysis (what changed before the rise?)
  Then: D1 metrics correlation (which metric moved first?)
  Look for: N+1 queries, missing indexes, connection pool exhaustion.

DATA CORRUPTION (wrong data, missing data, duplicate data):
  First check: C1 Evidence (which records? which time range? which tenants?)
  Then: C3 Change Analysis (schema migration? backfill? code change?)
  Then: C4 IS/IS NOT (which records are corrupt? which are not?)
  Look for: missing idempotency key, failed migration, race condition.

SECURITY INCIDENT:
  First: contain. Then: C1 evidence gathering.
  Do NOT: communicate hypothesis until evidence is gathered (attacker may be watching).
  Look for: OWASP API Top 10 violations (API1 BOLA is most common).
  Preserve: all logs before any system changes.

REPEATED BUG (same failure recurring):
  The previous fix addressed a symptom, not the root cause.
  First check: C8 Swiss Cheese (what latent condition was not fixed?)
  Then: C11 Drift Detection (did the system drift back after the last fix?)
  Then: C7 Fault Tree (were there parallel causal paths the last RCA missed?)

RISK ASSESSMENT (proactive, no incident):
  Run C13 FMEA only.
  Skip all other checks (no incident to investigate).
```

---

### Step 1.8 — Evidence Availability

```
ASSESS BEFORE STARTING: what evidence exists?

EVIDENCE TYPE         | WHERE TO FIND           | QUALITY SIGNAL
──────────────────────────────────────────────────────────────────
Application logs      | CloudWatch, Datadog, ELK | Structured JSON > raw text
Distributed traces    | Jaeger, Zipkin, Datadog  | Full trace vs partial span
Metrics               | Prometheus, Grafana      | Pre-incident baseline exists?
Deployment history    | CI/CD system, git log    | Timestamps match incident window?
Configuration changes | AWS Config, Terraform    | Config drift detected?
Feature flag changes  | LaunchDarkly, Unleash    | Flag state at incident time?
Database query logs   | pg_stat_statements       | slow_query_log enabled?
User reports          | Support tickets, Slack   | Volume + specific error messages?
Error budget          | SLO dashboard            | How much was consumed?
Previous postmortems  | Wiki / postmortem repo   | Same failure mode before?

MISSING EVIDENCE RULE:
  State explicitly which evidence is missing.
  Do NOT proceed to hypothesis evaluation if critical evidence is absent.
  Example: "Distributed traces not captured for this service."
           "Deployment history unavailable before 14:00 IST."
  Missing evidence = hypothesis is UNDERDETERMINED (status term from Section 5).
  Action: gather the missing evidence first, or mark hypotheses as underdetermined.
```

---

### Step 1.9 — Applicability Matrix

```
CHECK  NAME                      LIVE  PM   PRO   OUT   PERF  DATA  SEC   REP
──────────────────────────────────────────────────────────────────────────────
COMPACT TRIBUNAL                  ✅★  ⚠️   ❌    ✅    ✅    ✅    ✅    ⚠️

INVESTIGATION PHASE
C1   Evidence Gathering            ✅   ✅   ❌    ✅    ✅    ✅    ✅    ✅
C2   Timeline Reconstruction       ⚠️   ✅   ❌    ✅    ✅    ✅    ✅    ✅
C3   Change Analysis               ✅   ✅   ❌    ✅    ✅    ✅    ✅    ✅

SCOPING PHASE
C4   IS / IS NOT Analysis          ✅   ✅   ❌    ✅    ✅    ✅    ✅    ✅

HYPOTHESIS PHASE (Deep Reasoning embedded)
C5   5 Whys                        ✅   ✅   ❌    ✅    ✅    ✅    ✅    ✅
C6   Fishbone + Conjectures        ⚠️   ✅   ❌    ✅    ✅    ✅    ✅    ✅
C7   Fault Tree + Prosecution      ❌   ✅   ❌    ⚠️    ✅    ✅    ✅    ✅
C8   Swiss Cheese & Barriers       ❌   ✅   ❌    ✅    ✅    ✅    ✅    ✅★
C9   Blast Radius                  ✅   ✅   ❌    ✅    ✅    ✅    ✅    ✅

CONCLUSION PHASE (Deep Reasoning verdict)
C10  Root Cause Statement          ✅   ✅   ❌    ✅    ✅    ✅    ✅    ✅
C11  Drift Detection               ❌   ✅   ✅    ⚠️    ✅    ✅    ⚠️    ✅★

ACTION PHASE
C12  Corrective & Preventive       ✅   ✅   ❌    ✅    ✅    ✅    ✅    ✅
C13  FMEA                          ❌   ❌   ✅    ❌    ❌    ❌    ❌    ❌

SYSTEM-SPECIFIC
D1   Distributed Systems RCA       ⚠️   ✅   ❌    ✅    ✅    ✅    ✅    ✅
A1   AI System RCA                 ⚠️   ✅   ✅    ⚠️    ✅    ✅    ❌    ✅

LIVE=Live incident, PM=Post-Mortem, PRO=Proactive
OUT=Outage, PERF=Performance, DATA=Data corruption, SEC=Security, REP=Repeated bug
★=most important for this type. ⚠️=partial applicability.
```

---

## SECTION 2 — COMPACT TRIBUNAL (LIVE incidents and simple post-mortems)

```
USE WHEN: LIVE incident OR simple post-mortem (one service, one failure mode).
SKIP WHEN: complex distributed incident, data corruption, security, repeated bug.
           Those need the full check sequence.

TIME BUDGET: 5-10 minutes for LIVE. 20 minutes for simple post-mortem.

COMPACT FORMAT:

STEP 1: FRAME
  What is the observable failure? (one sentence)
  What decision is needed? (mitigate X / understand Y / prevent Z)
  What evidence do I have? (list)
  What is unknown? (list)

STEP 2: THREE CONJECTURES
  For each conjecture — answer all four fields:
    Claim:     what does this say is the cause?
    Mechanism: how does it produce the observed failure?
    Falsifier: what evidence would prove this wrong?
    Evidence:  what currently supports this?
  
  Always generate three — including:
    The most obvious explanation (the deploy, the cron job, the config)
    An adversarial alternative (what if it's NOT the obvious thing?)
    A simpler explanation (is there a one-line fix hiding behind complexity?)

STEP 3: STRONGEST OBJECTION PER CONJECTURE
  For each: what is the single most damaging thing that could be wrong?
  Be specific. "This doesn't explain why entity 001 was affected but 002 was not."

STEP 4: COMPARE AGAINST AVAILABLE EVIDENCE
  Which conjecture best explains ALL observed data?
  Which is contradicted by any evidence?
  Which cannot be evaluated yet (missing evidence)?

STEP 5: COMPACT VERDICT
  Most probable cause: [one sentence]
  Confidence: HIGH / MEDIUM / LOW + one reason for uncertainty
  Immediate action: [what to do in the next 10 minutes]
  Best next test: [what evidence would confirm or refute this]
  What would change the verdict: [the specific evidence that would shift the conclusion]

NOTE: Compact Tribunal produces a hypothesis, not a confirmed root cause.
      Full checks C1-C12 are needed for a confirmed root cause statement.
```

---

## SECTION 3 — INVESTIGATION PHASE

---

### CHECK C1 — Evidence Gathering

```
QUESTION: Before forming any hypothesis — do we have the evidence
          to distinguish between plausible causes?

RULE: gather evidence BEFORE forming hypotheses.
WHY: hypotheses formed first bias evidence collection.
     Confirmation bias: you find evidence that supports the hypothesis
     you already believe. You stop looking when you find it.
     Evidence-first: you look at ALL data before explaining it.

EVIDENCE COLLECTION CHECKLIST:

APPLICATION LOGS:
  ☐ What error messages appeared? Exact text, not paraphrase.
  ☐ What was the first error in the log? (not the last or most frequent)
  ☐ Were errors coming from one service or multiple?
  ☐ Did errors start before or after user reports?
  ☐ Stack trace: where in the code did the exception originate?
  
  KEY QUESTION: "What was the first abnormal log entry?"
  The first is usually causally closer to the root than the last.
  A flood of 10,000 timeout errors in 5 minutes is one event.
  The first error before the flood is more informative.

DISTRIBUTED TRACES:
  ☐ Find the trace for a failing request.
  ☐ Which span has the high latency or error?
  ☐ What was the parent span of the failed span?
  ☐ Was the failure cascading from a dependency?
  ☐ Did all requests fail or only some?

METRICS:
  ☐ Which metric changed first? (the leading indicator)
  ☐ Error rate, latency P95, request rate, DB connections, CPU, memory.
  ☐ Was there a spike? A gradual rise? A step change?
  ☐ Did any metric change BEFORE the first user report?
  ☐ Is there a baseline to compare against?
  
  CRITICAL: the metric that changed FIRST is often causally upstream.
  Latency rising → then error rate rising = latency caused the errors.
  Error rate rising → then latency rising = errors caused the latency.
  Order matters.

DEPLOYMENT HISTORY:
  ☐ What deployed in the 24-48h before the incident?
  ☐ What was the exact deploy time relative to first error?
  ☐ What files changed in the deploy?
  ☐ Were there multiple deploys? (most recent is not always the cause)
  ☐ Feature flags: did any flag change state near incident time?
  ☐ Configuration: env vars, secrets, infra config, Kubernetes manifests?
  ☐ Schema migrations: did any run recently? Was it backwards-compatible?

EXTERNAL SIGNALS:
  ☐ Did any third-party service (Tally, WhatsApp, Claude API) degrade?
  ☐ AWS status page: any regional events at incident time?
  ☐ DNS or network issues?
  ☐ Certificate expiry?

USER REPORTS:
  ☐ What exactly did users experience? (not "it was slow" — which action failed?)
  ☐ Did all users see it or specific users/tenants?
  ☐ Was it consistently broken or intermittent?
  ☐ What time did the first user report arrive vs first alert?

EVIDENCE COMPLETENESS GATE:
  Before hypothesis evaluation: state what you have and what is missing.
  Hypothesis formed on incomplete evidence = UNDERDETERMINED status.
  Never let "we'll look at more evidence later" become "we never did."
```

---

### CHECK C2 — Timeline Reconstruction

```
QUESTION: In what exact sequence did events occur?
          What was the first signal? What was the detection gap?

BUILD THE INCIDENT TIMELINE:
  List every event in chronological order with timestamps.
  Sources: logs, metrics, alerts, deploys, user reports, Slack messages.
  
  TIMELINE TEMPLATE:
    T+00:00  [event description] [source]
    T+02:34  [event description] [source]
    T+08:12  [event description] [source]
    ...
  
  EXAMPLE:
    T+00:00  Deploy v2.14.1 completed (CI/CD log)
    T+04:23  DB connection pool: 18/20 connections active (Prometheus)
    T+06:51  First 504 Gateway Timeout in application log (CloudWatch)
    T+09:15  Error rate exceeds 5% alert fires (PagerDuty)
    T+11:42  First user report in support channel (Slack)
    T+23:00  On-call engineer acknowledges alert (PagerDuty)
    T+28:00  Engineer identifies N+1 query as likely cause (Slack)
    T+41:00  Deploy reverted (CI/CD log)
    T+45:00  Error rate returns to baseline (Prometheus)

TIMELINE ANALYSIS — WHAT TO EXTRACT:

  FIRST SIGNAL:        T+04:23 DB connection pool rising.
                       This is the true start of the incident.
                       Not T+06:51 (first error) or T+11:42 (first report).
                       
  DETECTION GAP:       T+04:23 (first signal) to T+09:15 (first alert) = 4m 52s.
                       Could the alert have fired at T+04:23?
                       If yes: improve alerting threshold or add new alert.
                       
  RESPONSE TIME:       T+09:15 (alert) to T+23:00 (acknowledge) = 13m 45s.
                       Was this within SLO? Within on-call SLA?
                       
  DIAGNOSIS TIME:      T+23:00 (acknowledge) to T+28:00 (hypothesis) = 5 min.
                       
  MITIGATION TIME:     T+28:00 (hypothesis) to T+41:00 (revert) = 13 min.
                       
  TOTAL IMPACT:        T+06:51 to T+45:00 = 38 minutes of elevated errors.

TIMELINE INSIGHT:
  The FIRST metric to move = the leading indicator.
  Leading indicator = causally closest to the root cause.
  "DB connections rose before errors appeared"
  → something caused DB connections to rise.
  → that something is the root cause, not the errors.

WHY THE TIMELINE MATTERS:
  Without it: engineers argue about what happened and when.
  With it: the sequence of events is a shared fact.
           Arguments move from "what happened" to "why it happened."
           That is the only productive argument in an RCA.
```

---

### CHECK C3 — Change Analysis

```
QUESTION: What changed in the 24-48 hours before the incident?
          Is the change the proximate cause?

WHY THIS IS THE FIRST CHECK IN LIVE INCIDENTS:
  The majority of production software incidents follow a change.
  Code deploy, config change, schema migration, feature flag,
  infrastructure change, third-party API update.
  Change Analysis does not prove causation.
  It identifies the most likely proximate cause for investigation.

CHANGE INVENTORY (gather all of these):

  CODE CHANGES:
    What was deployed? What files changed?
    Was the deploy size large or small? (large deploys = higher blast radius)
    Were there dependency version bumps? (transitive vulnerabilities)
    Was the deploy to all instances simultaneously or canary?
    
  CONFIGURATION CHANGES:
    Env var changes? New secrets rotation?
    Kubernetes resource limits changed?
    Infrastructure as Code diff?
    
  SCHEMA CHANGES:
    Any migration run? Was it backwards-compatible?
    Was it run with CONCURRENTLY? (if not: table lock)
    Was a column renamed or type changed?
    
  FEATURE FLAGS:
    Did any feature flag change state near incident time?
    Which flag? For which users or tenants?
    Was it a rollout (gradual) or instant switch?
    
  THIRD-PARTY CHANGES:
    Did a dependency update its API?
    Did a certificate expire?
    Did a third-party rate limit change?
    Did the external service have an incident at the same time?
    
  TRAFFIC CHANGES:
    Did traffic volume change significantly? (autoscaling triggered?)
    New client or integration started sending traffic?
    Scheduled job fired that normally doesn't?

CORRELATION VS CAUSATION:
  Finding a change near the incident is NOT confirmation of causation.
  It is a CONJECTURE to test.
  
  TEST: "If we revert this change, does the incident stop?"
        If yes: the change is part of the causal chain.
        If no: the change is correlated but not the cause.
  
  SMELL: "We reverted the deploy and it fixed it. Case closed."
         Revert = mitigation. Not RCA.
         "Why did the deploy cause the failure?" is the RCA question.
         "What in the deploy triggered the failure?"
         "Why was no test in CI/CD catching this?"
         These are the questions that prevent recurrence.

CHANGE CORRELATION TABLE:
  Change | Time | Delta from incident | Files/tables/flags affected | Tenants affected
  [fill in for every change found]
```

---

## SECTION 4 — SCOPING PHASE

---

### CHECK C4 — IS / IS NOT Analysis (Kepner-Tregoe)

```
QUESTION: By identifying what IS affected vs what IS NOT,
          can we eliminate entire categories of potential cause?

WHY THIS WORKS:
  Every distinction between IS and IS NOT is a constraint on the cause.
  "The cause must be something that affects THIS but not THAT."
  Enough distinctions → the cause is the only thing left.

THE FOUR DIMENSIONS:

  WHAT:
    IS:      checkout service returns 504.
    IS NOT:  browse service works. Login works. Search works.
    → Cause is checkout-specific. Not global infrastructure.

  WHERE:
    IS:      entity_001 data is wrong.
    IS NOT:  entity_002 through entity_005 data is correct.
    → Cause is entity_001-specific. Isolation failure or entity config.

  WHEN:
    IS:      failing since 14:03 IST on 2026-07-17.
    IS NOT:  working at 13:58 IST same day.
    → Something changed in the 5-minute window 13:58-14:03.

  EXTENT:
    IS:      10% of requests fail.
    IS NOT:  90% succeed (same users, same operation).
    → Intermittent. Likely race condition or one unhealthy instance.

DECISION TABLE:
  Dimension | IS                    | IS NOT                | Implication
  What      | checkout 504          | browse works          | checkout-specific
  Where     | eu-west-1             | us-east-1 works       | regional issue
  When      | after 14:03           | before 14:03 worked   | deploy or config change
  Extent    | all authenticated     | anonymous users fine  | auth-layer issue

READ THE IMPLICATIONS COLUMN:
  Each implication eliminates a category of hypotheses.
  "Regional issue" eliminates: code bugs, data issues, feature flags.
  "Auth-layer issue" eliminates: frontend, database, infrastructure.
  The remaining hypotheses are the ones worth investigating.

SMELL: investigation jumps immediately to the most dramatic hypothesis.
       "The database must be corrupted."
       IS/IS NOT would have shown: 95% of DB queries succeed.
       The cause is NOT a corrupt database.
       Without IS/IS NOT: 2 hours investigating the wrong thing.
```

---

## SECTION 5 — HYPOTHESIS PHASE (DEEP REASONING EMBEDDED)

```
This phase applies the Deep Reasoning tribunal framework.
Evidence-first (C1-C4 done). Now: form hypotheses rigorously.
Treat the investigation as a tribunal, not a monologue.
Generate competing explanations. Force each to expose how it fails.
Prosecute the strongest objections. Issue a verdict on the evidence.
```

---

### CHECK C5 — 5 Whys

```
QUESTION: By drilling down on each "why", can we follow one causal
          thread from symptom to systemic cause?

WHEN TO USE:
  Simple incidents. Single service. Clear causal chain.
  When a single thread connects the symptom to the cause.
  Budget: 5-10 minutes.

WHEN TO SKIP TO C7 (FAULT TREE):
  Complex distributed incidents.
  Multiple services involved.
  When the first "why" has more than one answer.
  Data corruption or security incidents.

THE DRILL:
  Start with the observable symptom.
  Ask "why?" for each answer until you reach a systemic cause.
  A systemic cause: a missing process, design weakness, or missing control.
  NOT a person's action. The system allowed the person's action to matter.

EXAMPLE — MORNING BRIEF NOT DELIVERED:
  Symptom:  Morning brief was not delivered at 06:00 IST.
  Why 1:    The WhatsApp delivery job did not fire.
  Why 2:    The Celery Beat process had stopped.
  Why 3:    The pod restarted due to OOM and did not recover.
  Why 4:    No liveness check restarted the process after OOM.
  Why 5:    The Liveness Guardian was not deployed for Celery Beat.
  Root:     Systemic. No operational monitoring for Celery Beat process health.

STOPPING RULE:
  Stop when the answer is: "We don't have X" or "We never built X."
  These are systemic causes. Actionable. System-level.
  Do NOT stop at: "The engineer didn't check" or "They forgot."
  Those are symptoms of a missing process, not root causes.

LIMITATION:
  5 Whys follows ONE thread.
  If the incident has parallel causes (AND/OR gates): use C7 Fault Tree.
  SMELL: 5 Whys arrives at a root cause but the incident recurs.
         A parallel causal path was missed.
```

---

### CHECK C6 — Fishbone Diagram + Conjecture Structure

```
QUESTION: Across ALL possible cause categories, what could have
          caused this incident? What is the strongest case for each?

PURPOSE: hypothesis GENERATION (not evaluation — that is C7).
         Ensures no category of cause is missed before investigation starts.

FISHBONE CATEGORIES FOR SOFTWARE:
  Code:          logic error, null pointer, edge case, algorithm wrong
  Configuration: wrong env var, wrong secret, wrong limit, wrong flag
  Infrastructure: OOM, disk full, network partition, AZ failure
  Data:          corrupt record, missing record, wrong type, volume spike
  External:      third-party API change, certificate expiry, rate limit
  Process:       missing review gate, missing test, missing monitoring
  People:        knowledge gap, insufficient handover, on-call burnout

FOR EACH CANDIDATE CAUSE — APPLY THE CONJECTURE STRUCTURE (Deep Reasoning):

  CONJECTURE TEMPLATE:
    Claim:       [what this says is the cause]
    Mechanism:   [how it produces the observed failure — be specific]
    Scope:       [where this explains the evidence / where it does not]
    Predictions: [what else should be observable if this is true]
    Falsifier:   [what evidence would prove this wrong]
    Evidence:    [what currently supports this conjecture]
    Assumptions: [what must be true for this to hold]

EXAMPLE CONJECTURE — N+1 QUERY:
  Claim:       The new /vouchers endpoint has an N+1 query on tenant_id.
  Mechanism:   Each voucher triggers a separate query for entity metadata.
               At 500 vouchers, this is 501 queries instead of 2.
               DB connection pool exhausted. All other queries queue.
               Queue fills. 504 timeouts cascade.
  Scope:       Explains: checkout timeouts, DB pool exhaustion.
               Does NOT explain: why entity_002 was unaffected.
               IS/IS NOT check: entity_001 has 500 vouchers. Others have < 10.
  Predictions: DB slow query log should show SELECT on entity_metadata
               firing 500+ times in a 30-second window.
               pg_stat_statements should show high call count on that query.
  Falsifier:   If DB connection pool is healthy during the incident window,
               this conjecture is wrong.
  Evidence:    Latency rose before errors (metric correlation).
               New endpoint deployed at T+00:00.
               entity_001 is the only affected entity (IS/IS NOT).
  Assumptions: The new endpoint does not use eager loading or DataLoader.

REJECT A CONJECTURE FROM THE LIST WHEN:
  It has no mechanism (just a label: "the database was slow")
  It is a paraphrase of another conjecture
  It has no way to be falsified
  It is contradicted by IS/IS NOT evidence already gathered

GENERATE 3-7 CONJECTURES:
  Include: the most obvious (change-correlated) explanation
  Include: an adversarial alternative (what if it is NOT the obvious thing?)
  Include: a simpler null explanation (what if a single missing config is the cause?)
  Include: the human factors angle (what process allowed this to reach production?)
```

---

### CHECK C7 — Fault Tree Analysis + Prosecution Stances

```
QUESTION: What is the complete logical tree of conditions that
          could produce this failure? Are there AND gates or OR gates?

WHEN TO USE:
  Complex distributed incident. Multiple services.
  Repeated bug (parallel paths missed in previous RCA).
  Any incident where C5 5 Whys produced only one answer.

FAULT TREE STRUCTURE:
  TOP EVENT: the observable failure
             (e.g. "Morning brief not delivered to owner")
  
  OR GATE: any one sub-event is sufficient to cause the top event.
    Sub-event A: WhatsApp delivery failed
    Sub-event B: Brief generation failed
    Sub-event C: Brief triggered but content was empty
    
  AND GATE: ALL sub-events must be true simultaneously.
    Sub-event A: Retry logic fired (AND)
    Sub-event B: Idempotency-Key not implemented (AND)
    = BOTH must be true for double-charge to occur
  
  WHY THIS MATTERS:
    OR gate: fixing any one sub-event is sufficient.
    AND gate: BOTH conditions must be fixed to prevent recurrence.
              Fixing only one leaves the system vulnerable.

PROSECUTION STANCES (Deep Reasoning — attack every conjecture):
  Apply all six stances to each conjecture from C6.
  
  MECHANIST STANCE (find missing causal links):
    "The N+1 query causes DB exhaustion" — is the mechanism complete?
    Does 500 queries actually exhaust the pool? What is pool size?
    If pool size is 100, 500 queries queues but does not exhaust immediately.
    Missing link: what triggers the cascade from queuing to 504?
    
  SKEPTIC STANCE (seek counterexamples and alternative causes):
    "entity_001 is the only entity affected — IS this because of voucher count?"
    Could it be: entity_001 has a different DB partition?
                 entity_001 has a different feature flag?
                 entity_001's data has a specific format that triggers the bug?
    These counterexamples must be tested before the conjecture is accepted.
    
  EMPIRIC STANCE (what observable evidence distinguishes this?):
    "What evidence would we see in the logs/metrics if N+1 is the cause?"
    Answer: pg_stat_statements shows >500 calls to SELECT entity_metadata in 30s.
    "Has this been checked?" If not: check it before accepting the conjecture.
    
  FORMALIST STANCE (test internal consistency):
    "If N+1 is the cause, it should affect ALL tenants with >N vouchers."
    entity_002 has 200 vouchers and was not affected.
    This is internally inconsistent. The N+1 conjecture is WEAKENED.
    Must be revised: maybe N+1 only triggers at >400 vouchers (connection pool size).
    
  ADVERSARY STANCE (construct the strongest case it is wrong):
    "The strongest argument AGAINST N+1 being the cause:
     The endpoint was deployed at T+00:00. The error started at T+06:51.
     If N+1 was the cause, why the 6-minute delay?
     What changed at T+06:51 that N+1 alone doesn't explain?"
    
  MINIMALIST STANCE (is there a simpler explanation?):
    "Is there a simpler explanation that accounts for all the same evidence?
     Could a single missing index explain the same DB exhaustion?
     A sequential scan on a 1M row table at T+06:51 when the background job ran?"
    If the simpler explanation accounts for all evidence: prefer it.
    Parsimony: the simplest explanation that fits all evidence wins.

DEFENSE:
  For each prosecution objection: can the conjecture answer it?
    Answer without changing core claim: conjecture SURVIVES this objection.
    Must narrow scope: conjecture WEAKENED but still viable.
    Must revise assumption: note the revision, re-examine.
    Cannot answer: objection DAMAGES the conjecture significantly.
  
  Do NOT erase prosecution objections that damage a conjecture.
  They remain on the record.
  A defense that makes the conjecture compatible with every outcome
  is a sign the conjecture is unfalsifiable. Reject it.
```

---

### CHECK C8 — Swiss Cheese Model & Barrier Analysis

```
QUESTION: Which defense layers failed?
          What latent conditions made the system fragile
          BEFORE the triggering event occurred?

THE SWISS CHEESE INSIGHT:
  An incident occurs when the holes in ALL defense layers
  align simultaneously. Any one layer holding prevents the incident.
  
  Active failure:   what TRIGGERED the incident. (the final event)
  Latent condition: a hole that was ALREADY OPEN before the incident.
  
  KEY RULE: spend 80% of analysis time on LATENT CONDITIONS.
  Active failure: "Engineer deployed code without prod-scale testing."
  Latent conditions that allowed this to matter:
    No prod-scale test environment exists.
    CI pipeline does not run migration tests.
    No canary deployment — went straight to 100%.
    No rollback gate that automatically triggers on error rate spike.
    No rate limiting on the new endpoint.
  
  FIX: corrective actions address the LATENT CONDITIONS.
       "Engineer should have tested better" does not fix the system.
       "We need a prod-scale test environment" fixes the system.
       Next engineer who makes the same mistake will be caught
       by the now-repaired defense layer.

BARRIER INVENTORY (list all defense layers that should have caught this):

  LAYER: Requirements
    Barrier: non-functional requirements for load. Was pagination specified?
    Status: [HELD / FAILED / ABSENT]
    Evidence: [what happened at this layer]
    
  LAYER: Code Review
    Barrier: reviewer should flag N+1 patterns in new endpoints.
    Status: [HELD / FAILED / ABSENT]
    Evidence: PR was approved. N+1 was not flagged.
    Latent: no N+1 detection in linting or code review checklist.
    
  LAYER: Testing
    Barrier: integration test should cover the new endpoint under load.
    Status: [HELD / FAILED / ABSENT]
    Evidence: Tests pass on 100-row test DB. Production has 500,000 rows.
    Latent: no production-scale test environment.
    
  LAYER: CI/CD Pipeline
    Barrier: performance regression test should catch query plan change.
    Status: [HELD / FAILED / ABSENT]
    Evidence: No performance test in CI pipeline.
    Latent: no k6 baseline test on new endpoints before deploy.
    
  LAYER: Canary / Progressive Deployment
    Barrier: deploy to 5% of traffic first. Monitor error rate.
    Status: [HELD / FAILED / ABSENT]
    Evidence: Deployed to 100% simultaneously.
    Latent: no canary deployment configured.
    
  LAYER: Monitoring & Alerting
    Barrier: alert on DB connection pool > 80% utilisation.
    Status: [HELD / FAILED / ABSENT]
    Evidence: First alert at T+09:15. DB pool saturated at T+04:23.
    Latent: no DB connection pool alert configured.
    
  LAYER: Circuit Breaker
    Barrier: if DB query fails 5 times → open circuit → return cached data.
    Status: [HELD / FAILED / ABSENT]
    Evidence: No circuit breaker. All requests queued for timeout.
    Latent: circuit breaker not configured for the DB query path.

BLAMELESS CULTURE:
  The barrier inventory is NOT a list of things individuals failed to do.
  It is a list of SYSTEM GAPS that allowed individual actions to propagate.
  If every barrier had been in place, the individual action would not have
  become an incident. Fix the barriers. Not the people.
```

---

### CHECK C9 — Blast Radius Mapping

```
QUESTION: How far did the failure propagate?
          Which components, tenants, users, and operations were affected?

WHY BLAST RADIUS MATTERS:
  Blast radius determines: severity assessment accuracy,
  who to notify, which data may need remediation,
  and whether the fix is sufficient or other services are still affected.

MAP ACROSS FIVE DIMENSIONS:

  SERVICES AFFECTED:
    Which services returned errors?
    Which services had elevated latency?
    Which services were cascaded into by the failing service?
    Map the dependency graph: failing node → downstream nodes it affected.
    In our architecture: which DAGs were blocked by the failing node?

  TENANTS / ENTITIES AFFECTED:
    Was this all tenants or specific tenants?
    Was it all entities within a tenant or specific entities?
    Isolation check: did this cross tenant boundaries?
    (If yes: severity escalates. RLS or tenant isolation failure.)

  USERS AFFECTED:
    How many users experienced the failure?
    Which user roles? (OWNER_TRUSTEE? ACCOUNTS_HEAD? all?)
    Was it all users or a percentage?

  OPERATIONS AFFECTED:
    Which specific API endpoints, DAG nodes, or DB queries?
    Was data READ affected? DATA WRITE affected? BOTH?
    Financial operations especially: was any write committed incorrectly?

  TIME DIMENSION:
    When exactly did the blast radius start? (first signal, not first report)
    When exactly did it end? (service recovery, not just revert)
    Was there a tail (some requests still failing after main recovery)?

DATA REMEDIATION ASSESSMENT:
  Did any write operations complete incorrectly during the incident?
  Are there duplicate records? Missing records? Corrupted values?
  If yes: data remediation is part of the corrective action.
  List every table and every record range that may need remediation.
  SMELL: blast radius mapping stops at service recovery.
         "The service is back up." is not complete.
         Data written during the incident may still be wrong.
```

---

## SECTION 6 — CONCLUSION PHASE (DEEP REASONING VERDICT)

---

### CHECK C10 — Root Cause Statement + Status Taxonomy + Confidence

```
QUESTION: What is the verified root cause?
          What is our confidence? What would change the conclusion?

ADJUDICATE EACH CONJECTURE — ASSIGN EXACTLY ONE STATUS:

  SURVIVES:          supported by evidence. Not defeated by material criticism.
                     Prosecution stances found no fatal objections.
                     Counterfactual test passes: removing this cause would prevent recurrence.

  WEAKENED:          plausible but damaged by unresolved criticism.
                     Some prosecution objections not fully answered.
                     Still the most probable explanation despite weaknesses.
                     Note what the unresolved objection is.

  REFUTED:           contradicted by decisive evidence or its own commitments.
                     IS/IS NOT analysis ruled it out.
                     Formalist stance found internal inconsistency.
                     Empiric evidence expected was not found.

  UNDERDETERMINED:   insufficient evidence to separate from rival explanations.
                     Two conjectures predict the same observations.
                     Missing evidence named explicitly.
                     Action: gather the named missing evidence.

  OUT OF SCOPE:      cannot be evaluated with available evidence.
                     Not relevant to this specific incident.

DO NOT FORCE A SINGLE WINNER:
  If two conjectures both SURVIVE: there are two contributing causes.
  Both must be addressed in corrective actions.
  "The incident had a single root cause" is rarely true.
  Most incidents have 3-5 contributing factors.

COUNTERFACTUAL VALIDATION (test before declaring SURVIVES):
  "If [root cause] had been absent, would the incident still have occurred?"
  Answer: YES → this is not the root cause (or not the complete cause).
  Answer: NO  → this is a necessary contributing cause.
  
  EXAMPLE:
    "If the Idempotency-Key had been implemented, would double-charge occur?"
    No → Idempotency-Key is a root cause. SURVIVES.
    
    "If the engineer had not deployed at 14:03, would the incident have occurred?"
    Yes (the same code would have been deployed later) → the deploy TIMING is not a cause.
    The deploy CONTENT is the cause.

ROOT CAUSE STATEMENT FORMAT:
  One precise sentence. No hedging.
  
  STRUCTURE:
    "Because [systemic condition], [triggering event] caused [impact]."
  
  EXAMPLE (SURVIVES + SURVIVES — two contributing causes):
    "Because no Idempotency-Key was implemented on POST /payments
     and the client's retry logic fires on timeout, network timeouts
     during peak load caused 47 duplicate payment charges affecting
     3 customers between 14:03 and 14:41 IST."
  
  NOT:
    "The system was slow and payments got duplicated." (symptoms, not causes)
    "An engineer deployed bad code." (active failure, not systemic cause)

CONFIDENCE CALIBRATION:
  HIGH:    Root cause explains all observed data.
           No surviving contradictory evidence.
           Counterfactual test passes clearly.
           
  MEDIUM:  Root cause explains most observed data.
           One unresolved prosecution objection.
           Named missing evidence that would raise to HIGH.
           
  LOW:     Root cause is most plausible of several underdetermined options.
           Significant missing evidence.
           Explicitly name what evidence would change the conclusion.

WHAT WOULD CHANGE THE VERDICT:
  Name the specific evidence or test that would shift the conclusion.
  "If pg_stat_statements shows no N+1 queries during incident window:
   the DB exhaustion conjecture is refuted. The cause must be elsewhere."
  This is the best next test for the team.

CONJECTURE STATUS TABLE:
  Conjecture                | Status         | Decisive Evidence        | Strongest Objection
  N+1 query on /vouchers    | SURVIVES       | pg_stat_statements x501  | Why 6min delay?
  Missing connection limit  | WEAKENED       | Pool was default size     | Doesn't explain entity scope
  External DB load spike    | REFUTED        | No external traffic change| Contradicts IS/IS NOT
  Missing index on entity_id| UNDERDETERMINED| EXPLAIN output needed     | May explain same symptoms
```

---

### CHECK C11 — Drift Detection

```
QUESTION: Did the system drift away from safe operating conditions
          before the incident? What signals were normalised that
          should have triggered action?

DRIFT INTO FAILURE (Sidney Dekker):
  Most incidents are not sudden surprises.
  The system drifted gradually away from safe operation.
  Small anomalies appeared. Engineers noticed them.
  Engineers normalised them. "We always see that warning."
  Then the incident occurred. It felt sudden. It was not.

DRIFT EVIDENCE — LOOK FOR:
  Warnings that appeared repeatedly but were never acted on.
  Alerts that were silenced or acknowledged without investigation.
  Metrics that were trending toward a threshold but nobody noticed.
  DLQ entries that accumulated without review.
  Error logs that contained warnings treated as background noise.
  TODO comments in code about known weaknesses.
  Previous postmortems that identified the same contributing factor.

CONCRETE DRIFT QUESTIONS:
  ☐ Was the DLQ growing in the days before the incident?
  ☐ Were there slow query warnings before the incident?
  ☐ Had error rate been slowly trending up for weeks?
  ☐ Had memory usage been climbing without investigation?
  ☐ Were there flaky tests that were quarantined and forgotten?
  ☐ Was autovacuum running? Was table bloat growing?
  ☐ Were there unacknowledged alerts that engineers had stopped looking at?
  ☐ Were there customer complaints that were not escalated?

DRIFT CORRECTION:
  Drift is a system-level problem. Not an individual problem.
  "We should be more vigilant" is not a corrective action.
  "We will alert on DLQ > 100 items for > 2 hours" is.
  "We will add a weekly metric health review to team standup" is.
  "We will run mutation testing monthly to catch tests nobody trusts" is.
  
  Alert on DRIFT. Not just on FAILURE.
  A metric at 70% of threshold for 3 days is actionable.
  A metric at 100% is an incident.
  Monitor the slope, not just the point.
```

---

## SECTION 7 — ACTION PHASE

---

### CHECK C12 — Corrective & Preventive Actions

```
QUESTION: What must change immediately? What must change to
          prevent recurrence? What new barriers must be built?

THREE TIME HORIZONS:

IMMEDIATE (hours — today):
  Mitigate the active failure if not yet resolved.
  Revert the proximate cause if possible.
  Manually remediate affected data if corrupt.
  Notify affected tenants/users if required.
  NOT root cause fixes. Symptom control.

SYSTEMIC (days to weeks — this sprint):
  Fix the actual root cause(s) identified in C10.
  These are code, schema, infrastructure, or process changes.
  Each action targets one SURVIVES conjecture from C10.
  
  RULE: one corrective action per identified root cause.
        "Fix the N+1 query" addresses the N+1 conjecture.
        "Implement Idempotency-Key" addresses the idempotency conjecture.
        If two conjectures survived: two corrective actions.

PREVENTIVE (weeks to months — next quarter):
  Repair the failed barriers from C8.
  Add missing barriers identified in C8.
  Each action closes one Swiss cheese hole.
  
  EXAMPLE PREVENTIVE ACTIONS (from C8 barriers):
    Barrier: No prod-scale test environment.
    Fix:     Nightly copy of prod data (anonymised) to staging.
             Migration tests run on staging before deploy.
    
    Barrier: No canary deployment.
    Fix:     Deploy pipeline: 5% → 30min → 50% → 30min → 100%.
             Automatic rollback if error rate > 1%.
    
    Barrier: No DB connection pool alert.
    Fix:     Alert: connection pool > 80% for 2 consecutive minutes.
    
    Barrier: No Liveness Guardian for Celery Beat.
    Fix:     expected_schedules table + 5-minute checker.
             Alert if schedule not run within window_minutes.

BLAMELESS ACTION LANGUAGE:
  WRONG: "Engineer must test more carefully before deploying."
         (Process gap presented as individual failure)
  RIGHT: "Add mandatory performance test step in CI pipeline
          that runs k6 smoke test on any new endpoint before deploy."
         (System change that catches the same mistake from any engineer)

OWNER + DEADLINE PER ACTION:
  Every action has one owner (a person, not a team).
  Every action has a deadline (a date, not "soon").
  Undated actions are never done.
  Actions without owners have no accountability.
```

---

### CHECK C13 — FMEA (PROACTIVE context only)

```
PROACTIVE MODE ONLY. Skip for all incident investigation contexts.

QUESTION: Before an incident: what are the highest-risk failure modes
          in this system? Where should we invest in prevention?

FMEA PROCESS:

  STEP 1: Identify components.
    List every significant component: DAGs, services, integrations,
    DB tables, external dependencies, jobs, workers.

  STEP 2: For each component: list failure modes.
    "What could this component fail to do?"
    Multiple failure modes per component are common.

  STEP 3: For each failure mode: score three dimensions.

    SEVERITY (1-10 — impact if it fails):
      1-3:  minor inconvenience. User notices, system recovers.
      4-6:  significant. Feature unavailable. Data delays.
      7-9:  major. Financial impact. Data corruption risk.
      10:   catastrophic. Data loss. Regulatory breach. Revenue loss.

    PROBABILITY (1-10 — likelihood of occurrence):
      1-3:  rare. Once per year or less.
      4-6:  occasional. Once per quarter.
      7-9:  frequent. Weekly or daily.
      10:   near-certain. Known issue waiting to happen.

    DETECTABILITY (1-10 — how hard to detect when it fails):
      1-3:  easy. Alert fires immediately. Liveness Guardian catches it.
      4-6:  moderate. Manual investigation needed.
      7-9:  hard. Silent failure. Only discovered from user complaints.
      10:   invisible. No monitoring. User discovers days later.

    RISK PRIORITY NUMBER (RPN) = Severity × Probability × Detectability
    Range: 1-1000. Higher = higher priority.

  STEP 4: Rank by RPN. Address highest-RPN failure modes first.

FMEA TABLE:
  Component       | Failure Mode          | S  | P  | D  | RPN | Action
  Tally connector | Silent data mismatch  | 8  | 6  | 9  | 432 | Add variance alert
  Celery Beat     | Process dies silently | 9  | 5  | 9  | 405 | Add Liveness Guardian
  payment_approvals| Four-eyes bypass     | 10 | 3  | 7  | 210 | Add FSM DB trigger
  WhatsApp BSP    | Delivery fails silent | 7  | 4  | 8  | 224 | Add DLQ + alerting

  PRIORITISE: RPN > 300 = fix this sprint.
              RPN 100-300 = fix next quarter.
              RPN < 100 = monitor.

NOTE: High Detectability score = hardest to detect.
      The most dangerous failures are high-severity + low-probability + invisible.
      Invisible failures accumulate as latent conditions (Swiss Cheese holes).
```

---

## SECTION 8 — SYSTEM-SPECIFIC CHECKS

---

### CHECK D1 — Distributed Systems RCA

```
APPLIES TO: MICROSERVICES / DISTRIBUTED system type gate.

QUESTION: Which service in the dependency chain was the origin?
          Did a cascade amplify the blast radius?

DISTRIBUTED TRACING FIRST:
  Before any hypothesis: find the trace for a failing request.
  In Jaeger / Zipkin / Datadog APM:
    Find a trace where the request failed.
    Identify the span with the first ERROR or highest latency.
    The service owning that span = where the failure originated.
    All subsequent errors in the trace = cascade, not root cause.
  
  SMELL: investigating every service that returned errors.
         Only one service caused the errors. The others cascaded.
         Distributed tracing identifies which one in < 5 minutes.
         Without it: 2-hour investigation of the wrong services.

CASCADE PATTERN RECOGNITION:
  PATTERN 1 — SLOW DEPENDENCY:
    Service A calls Service B. B is slow.
    A's thread pool fills. A becomes slow.
    Service C calls A. C's thread pool fills. C becomes slow.
    ROOT: Service B. Services A and C are cascade victims.
    
  PATTERN 2 — RETRY STORM:
    Service B returns error. Service A retries 3x.
    100 clients × 3 retries = 300 requests to B.
    B was struggling at 100. Now overwhelmed at 300.
    B now fails for everyone.
    ROOT: both B's original failure AND A's unbounded retry.
    FIX: both must be fixed. Exponential backoff + jitter.

  PATTERN 3 — MISSING CIRCUIT BREAKER:
    B fails. A retries indefinitely. A hangs.
    All of A's connections occupied waiting for B.
    A becomes unavailable. Other services depending on A fail.
    ROOT: missing circuit breaker on A→B call.

DEPENDENCY GRAPH ANALYSIS:
  Draw: what calls what?
  In our architecture: which DAG node calls which external service?
  Identify: single points of failure in the dependency graph.
  A node that 3+ other nodes depend on = critical path.
  If it fails and has no circuit breaker → blast radius = all dependents.
```

---

### CHECK A1 — AI System RCA

```
APPLIES TO: AI-SYSTEM gate. Skip for pure non-AI systems.

QUESTION: Is the AI system's quality degrading? Why?
          Is this a model failure, a context failure, or a data failure?

AI INCIDENTS ARE DIFFERENT:
  Traditional system: binary failure. Works or doesn't.
  AI system: gradual quality degradation.
    Hallucination rate increases by 3%.
    Eval suite pass rate drops from 88% to 79%.
    RAGAS faithfulness drops from 0.84 to 0.71.
    These are incidents. They don't crash the system.
    They erode trust. They produce wrong financial data.
    They may not trigger any alert.

THREE LAYERS OF AI FAILURE:

  MODEL LAYER:
    LLM provider silently updated the base model.
    System prompt changed. Temperature changed.
    Token limits changed.
    Evidence: run the same prompt before/after. Compare outputs.
    FIX: pin to specific model version. Eval before model update.

  CONTEXT LAYER:
    Retrieved documents are stale or wrong.
    Knowledge base was updated with incorrect information.
    Embedding model was changed (semantic drift).
    Evidence: RAGAS context precision and context recall dropped.
    FIX: verify knowledge base currency. Add verified_at date per document.
         Alert when verified_at > 90 days for regulatory content.

  DATA LAYER:
    Production data changed in a way the model was not trained for.
    New fiscal year. New compliance rules. New entity added.
    Model still produces correct-looking output for incorrect rules.
    Evidence: domain expert review of outputs. Not automated metrics.
    FIX: update knowledge base when domain rules change.
         Re-run eval suite after any domain rule change.

AI-SPECIFIC EVIDENCE GATHERING:
  ☐ Eval suite pass rate: before vs after incident window.
  ☐ RAGAS metrics: faithfulness, relevancy, precision, recall.
  ☐ Production response sample: pull 50 recent responses for human review.
  ☐ Model version log: did provider change model version recently?
  ☐ Knowledge base changelog: what was added/removed/modified?
  ☐ Embedding model version: any change?
  ☐ System prompt git history: any change to prompt?

AI HALLUCINATION INCIDENT:
  Symptom: owner received wrong financial figures in morning brief.
  
  CONJECTURE A — INFERENCE LAYER:
    Claim:     LLM generated figures not present in retrieved context.
    Mechanism: Provider updated base model. New model hallucinates more on financial data.
    Falsifier: RAGAS faithfulness was high during incident window.
    Evidence:  RAGAS faithfulness dropped from 0.87 to 0.62 same day.
    Status:    SURVIVES.
    
  CONJECTURE B — CONTEXT LAYER:
    Claim:     Retrieved context contained stale section 11 rules.
    Mechanism: Knowledge base not updated after new fiscal year.
               LLM correctly summarised stale rules.
    Falsifier: If RAGAS faithfulness is high (LLM was faithful to context).
               If context was correct, this conjecture is wrong.
    Evidence:  RAGAS faithfulness = 0.87 (context was faithfully represented).
               But knowledge base has last_verified_at = 8 months ago.
    Status:    SURVIVES (different failure from A — both may be true).

  ROOT CAUSE (both SURVIVE — two contributing causes):
    "Because the LLM provider silently updated the model on July 15
     and the knowledge base has not been verified against current
     fiscal year rules, the morning brief contained both hallucinated
     figures and stale compliance thresholds."
```

---

## REPORT FORMAT

```
# ROOT CAUSE ANALYSIS REPORT
## [Incident Name / ID]
## Date of Incident:  [date + time]
## Date of Report:    [date]
## Context:           [LIVE / POST-MORTEM / PROACTIVE]
## Severity:          [SEV0 / SEV1 / SEV2 / SEV3]
## Status:            [ACTIVE / MITIGATED / RESOLVED]

---

## EXECUTIVE SUMMARY

[3-5 sentences.
 What happened? Who was affected? For how long?
 What is the confirmed root cause?
 What is the one most important corrective action?]

---

## INCIDENT TIMELINE

T+00:00  [event] [source]
T+XX:XX  [event] [source]
...
T+XX:XX  [service restored] [source]

Key intervals:
  First signal:      T+XX:XX  [what was it?]
  Detection gap:     XX min   [first signal to first alert]
  Response time:     XX min   [first alert to acknowledgment]
  MTTR:             XX min   [first signal to resolution]

---

## IS / IS NOT SUMMARY

Dimension | IS                           | IS NOT                    | Implication
What      |                              |                           |
Where     |                              |                           |
When      |                              |                           |
Extent    |                              |                           |

---

## BLAST RADIUS

Services affected:   [list]
Tenants affected:    [all / specific — list]
Users affected:      [count / percentage / roles]
Operations affected: [reads / writes / both / specific endpoints]
Data remediation:    [required / not required — if required: scope]

---

## CONJECTURE STATUS TABLE

Conjecture                  | Status         | Decisive Evidence       | Unresolved Objection
[name each hypothesis]      | [status]       | [what confirms/refutes] | [if any]

---

## ROOT CAUSE STATEMENT

[One precise sentence]:
"Because [systemic condition(s)], [triggering event] caused [impact]."

Confidence: [HIGH / MEDIUM / LOW]
Reason for confidence level: [explain]
What would change the verdict: [specific evidence or test]

---

## CONTRIBUTING FACTORS

[List all SURVIVES and WEAKENED conjectures that are contributing causes.
Not just the triggering event.]

1. [contributing factor 1]
2. [contributing factor 2]
...

---

## SWISS CHEESE — BARRIERS THAT FAILED

Barrier                     | Status  | Latent Condition (why the hole was open)
Requirements (NFR)          |         |
Code Review                 |         |
Testing                     |         |
CI/CD Pipeline              |         |
Canary / Progressive Deploy |         |
Monitoring & Alerting       |         |
Circuit Breaker             |         |
[add barriers specific to this incident]

---

## DRIFT SIGNALS NORMALISED

[List any warnings that were present before the incident but not acted on.]
Signal | How long it existed | Why it was normalised | Alert threshold needed

---

## CORRECTIVE ACTIONS

IMMEDIATE (done / in progress):
  ☐ [action] — Owner: [name] — Status: [DONE / IN PROGRESS]

SYSTEMIC (this sprint):
  ☐ [action] — Owner: [name] — Deadline: [date]
  ☐ [action] — Owner: [name] — Deadline: [date]

PREVENTIVE (next quarter — close the Swiss cheese holes):
  ☐ [barrier to repair] — Owner: [name] — Deadline: [date]
  ☐ [new barrier to add] — Owner: [name] — Deadline: [date]

---

## OPEN QUESTIONS (UNDERDETERMINED items)

Question | Evidence needed to resolve | Owner | Expected by
[list any underdetermined conjectures with their named missing evidence]

---

## LESSONS LEARNED

[3-5 specific, actionable lessons.
NOT: "we should be more careful."
YES: "We need a prod-scale test environment to catch migration
     regressions before they reach production."]

---

*RCA completed using: Evidence Gathering, Timeline, Change Analysis,*
*IS/IS NOT, 5 Whys / Fishbone / Fault Tree, Swiss Cheese & Barriers,*
*Blast Radius, Deep Reasoning tribunal (conjecture structure,*
*prosecution stances, status taxonomy, confidence calibration),*
*Drift Detection, Corrective & Preventive Actions.*
*Mental models: DAG (failure path), Kafka (DLQ/Idempotency/Liveness/Circuit Breaker),*
*OODA, Swiss Cheese, Kepner-Tregoe, Dekker's Drift into Failure,*
*Blameless Postmortem (Google SRE), FMEA.*
```

---

## ANALYST DISCIPLINE

```
0. EVIDENCE BEFORE HYPOTHESIS.
   The most common RCA failure: engineer forms hypothesis first,
   then looks for confirming evidence.
   Confirmation bias produces a confident wrong answer.
   Gather ALL evidence in C1. Form hypotheses in C6. Not before.

1. CHANGE ANALYSIS FIRST IN LIVE INCIDENTS.
   Most outages follow a deploy.
   C3 Change Analysis takes 2 minutes.
   It either confirms the proximate cause or eliminates it.
   Do it before any other hypothesis evaluation.

2. 5 WHYS STOPS AT THE SYSTEM, NOT THE PERSON.
   "The engineer didn't test properly" is never a root cause.
   "No production-scale test environment exists" is.
   If the answer to a "why" is a person's action:
   ask one more "why" — why was that action possible?
   That is the systemic cause.

3. SPEND 80% ON LATENT CONDITIONS.
   The triggering event (active failure) is usually obvious.
   The latent conditions (holes in Swiss cheese) are not.
   Fixing the triggering event prevents THIS incident from recurring.
   Fixing the latent conditions prevents THE NEXT incident.
   RCA exists to prevent the next incident.

4. NEVER FORCE A SINGLE ROOT CAUSE.
   Most incidents have 3-5 contributing factors.
   "The single root cause was X" is usually a sign the investigation
   stopped too early or prosecuted too few conjectures.
   If two conjectures both SURVIVE: there are two causes. Both must be fixed.

5. COUNTERFACTUAL BEFORE CONFIRMING ROOT CAUSE.
   "If this cause had been absent, would the incident have occurred?"
   Every SURVIVES conjecture must pass this test.
   If the answer is "yes, it would have still occurred":
   the identified cause is a contributing factor, not the root cause.

6. UNDERDETERMINED IS AN HONEST STATUS.
   Do not promote an underdetermined conjecture to SURVIVES
   because the team is under pressure to close the RCA.
   UNDERDETERMINED + named missing evidence is a valid conclusion.
   It tells the team exactly what to look for next.

7. BLAMELESS IS NOT OPTIONAL.
   If RCA culture is not blameless: engineers hide information.
   Hidden information produces incomplete RCAs.
   Incomplete RCAs produce recurring incidents.
   Recurring incidents indicate a broken RCA culture.
   Start by stating this explicitly before the investigation begins.

8. CORRECTIVE ACTIONS HAVE OWNERS AND DATES.
   An action without an owner is a suggestion.
   An action without a date is a dream.
   Every corrective action: one owner (a person, not a team).
                            one deadline (a date, not "soon").
   Review corrective action completion 30 days after RCA publication.
   Unimplemented actions = the next incident is being incubated.
```

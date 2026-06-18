export type ProgressEvidenceType =
  | 'GitHub Repo'
  | 'Commit'
  | 'Pull Request'
  | 'Paper'
  | 'Dataset'
  | 'Notebook'
  | 'Presentation'
  | 'Demo Video'
  | 'Other';

export type ProgressVerificationStatus = 'Pending' | 'Approved' | 'Needs Changes';

export type ProgressEvidenceLink = {
  id: string;
  type: ProgressEvidenceType;
  url: string;
  description: string;
};

export type ProgressReport = {
  id: string;
  projectName: string;
  reportingPeriod: string;
  hoursWorked: number;
  tasksCompleted: string;
  resultsAchieved: string;
  challenges: string;
  nextSteps: string;
  skillsUsed: string[];
  evidenceLinks: ProgressEvidenceLink[];
  verificationStatus: ProgressVerificationStatus;
  professorComment?: string;
  submittedAt: string;
};

const reportSeeds = [
  ['progress-001', 'Interpretable Machine Learning for Healthcare', 'Week of Feb 2, 2026', 12, 'Completed literature review on calibration and explanation fidelity for clinical risk models.', 'Produced a 9-page synthesis memo and model-audit checklist.', 'Clinical papers reported incompatible outcome definitions.', 'Finalize dataset schema and baseline audit notebook.', ['Literature Review', 'Calibration', 'Research Writing'], 'Approved', 'Excellent synthesis. The checklist is ready for the lab repository.'],
  ['progress-002', 'Interpretable Machine Learning for Healthcare', 'Week of Feb 9, 2026', 14, 'Cleaned de-identified model outputs and trained baseline calibration curves.', 'Reduced calibration error by 11 percent after isotonic regression.', 'Some subgroups had small sample sizes.', 'Run subgroup robustness checks.', ['Python', 'PyTorch', 'Calibration'], 'Approved', 'Strong progress and clear documentation of subgroup limits.'],
  ['progress-003', 'Robotics Navigation in Dynamic Environments', 'Week of Feb 2, 2026', 11, 'Implemented dynamic-obstacle scenarios in the ROS simulation harness.', 'Added 18 repeatable scenes and baseline planner metrics.', 'Planner logs were inconsistent across seeded runs.', 'Stabilize random seeds and add CI validation.', ['ROS', 'Python', 'Simulation'], 'Approved', 'Simulation scenarios are useful and well scoped.'],
  ['progress-004', 'Robotics Navigation in Dynamic Environments', 'Week of Feb 9, 2026', 13, 'Compared A* and DWA baselines under pedestrian crossing patterns.', 'Found DWA safer in dense scenes but slower in narrow corridors.', 'Collision-risk metric needed review.', 'Prepare plots for lab meeting.', ['C++', 'Planning', 'Data Visualization'], 'Pending', undefined],
  ['progress-005', 'LLM-Based Research Assistant for Literature Review', 'Week of Feb 2, 2026', 10, 'Built retrieval baseline using paper abstracts and citation metadata.', 'Top-10 retrieval precision reached 0.74 on seed benchmark.', 'Citation graph ingest missed workshop papers.', 'Add full-text chunks and rerankers.', ['Information Retrieval', 'Python', 'Evaluation'], 'Approved', 'Good benchmark framing; proceed to reranking.'],
  ['progress-006', 'LLM-Based Research Assistant for Literature Review', 'Week of Feb 9, 2026', 9, 'Implemented summary quality rubric and annotated 30 generated summaries.', 'Identified hallucinated method details in 5 examples.', 'Annotation guidelines need tighter examples.', 'Recruit two more annotators and calculate agreement.', ['LLM Evaluation', 'Research Methods', 'Python'], 'Approved', 'The rubric is strong; add agreement statistics next.'],
  ['progress-007', 'Predictive Analytics for Student Success', 'Week of Feb 2, 2026', 8, 'Cleaned advising records and documented missingness patterns.', 'Built reproducible feature dictionary and leakage-risk notes.', 'Several fields changed meaning across semesters.', 'Meet with advising office to validate fields.', ['SQL', 'Data Cleaning', 'Fairness Metrics'], 'Approved', 'Great attention to leakage risk.'],
  ['progress-008', 'Predictive Analytics for Student Success', 'Week of Feb 9, 2026', 10, 'Trained logistic regression and gradient boosting baselines.', 'Baseline AUC reached 0.78 with interpretable top features.', 'Model performance varied by cohort.', 'Run subgroup calibration and draft dashboard wireframe.', ['Scikit-learn', 'Statistics', 'Dashboarding'], 'Pending', undefined],
  ['progress-009', 'Financial Market Risk Modeling', 'Week of Feb 2, 2026', 11, 'Prepared market-return dataset and implemented historical VaR baseline.', 'Produced reproducible notebook with volatility clustering diagnostics.', 'Data vendor symbols changed for several ETFs.', 'Add macro factors and compare expected shortfall.', ['Python', 'Time Series', 'Econometrics'], 'Approved', 'Solid baseline with clear assumptions.'],
  ['progress-010', 'Computer Vision for Medical Imaging', 'Week of Feb 2, 2026', 12, 'Implemented U-Net baseline and preprocessing transforms for imaging dataset.', 'Initial Dice score reached 0.71 on validation split.', 'Augmentation pipeline distorted some labels.', 'Fix mask transforms and run ablations.', ['PyTorch', 'OpenCV', 'Medical Imaging'], 'Approved', 'Good baseline; check augmentation carefully.'],
  ['progress-011', 'Computer Vision for Medical Imaging', 'Week of Feb 9, 2026', 9, 'Analyzed failure cases by scanner source and image quality flags.', 'Found performance drop on low-contrast images and drafted mitigation plan.', 'Metadata is incomplete for one scanner site.', 'Request metadata clarification and test contrast normalization.', ['Error Analysis', 'Research Writing', 'Python'], 'Pending', undefined],
  ['progress-012', 'Human-AI Collaboration in Education', 'Week of Feb 2, 2026', 7, 'Drafted user-study protocol for AI hint timing and pilot-tested task flow.', 'Pilot found confusing hint timing labels and two logging bugs.', 'Recruitment screener was too broad.', 'Revise screener and instrumentation.', ['Study Design', 'User Research', 'Python'], 'Approved', 'Thoughtful pilot; please tighten recruitment criteria.'],
  ['progress-013', 'Climate Policy Data Analysis', 'Week of Feb 2, 2026', 10, 'Merged municipal climate policy records with census energy-burden variables.', 'Created county-level panel with reproducible cleaning scripts.', 'Policy start dates conflict across sources.', 'Prepare validation memo for data-source decisions.', ['R', 'GIS', 'Policy Analysis'], 'Approved', 'Strong data provenance work.'],
  ['progress-014', 'Climate Policy Data Analysis', 'Week of Feb 9, 2026', 8, 'Estimated difference-in-differences models for pilot cities.', 'Preliminary effects show larger reductions in high-burden neighborhoods.', 'Parallel trends need clearer visualization.', 'Create diagnostic plots and sensitivity checks.', ['Causal Inference', 'R', 'Visualization'], 'Pending', undefined],
  ['progress-015', 'Behavioral Economics and Decision Making', 'Week of Feb 2, 2026', 6, 'Coded open-ended survey responses for decision-making study.', 'Reached 0.82 inter-rater agreement after codebook revision.', 'Ambiguous confidence categories remained.', 'Run final adjudication session.', ['Survey Design', 'Thematic Coding', 'R'], 'Approved', 'Codebook is much clearer now.'],
  ['progress-016', 'Behavioral Economics and Decision Making', 'Week of Feb 9, 2026', 5, 'Prepared poster draft and summarized logistic regression results for choice task.', 'Poster includes methods, participant flow, and preliminary findings.', 'Need cleaner explanation of interaction term.', 'Revise poster narrative for symposium review.', ['Research Writing', 'R', 'Presentation'], 'Needs Changes', 'Please revise the interaction-term explanation before this is approved.'],
  ['progress-017', 'Brain-Computer Interface Signal Processing', 'Week of Feb 2, 2026', 13, 'Implemented EEG preprocessing filters and artifact-rejection notebook.', 'Improved signal quality checks and reduced noisy epochs by 18 percent.', 'Some participants have missing channel metadata.', 'Test classifier with cleaned features.', ['MATLAB', 'EEG', 'Signal Processing'], 'Approved', 'Excellent preprocessing evidence.'],
  ['progress-018', 'Brain-Computer Interface Signal Processing', 'Week of Feb 9, 2026', 12, 'Trained motor-imagery classifiers and compared feature windows.', 'Best model reached 79 percent balanced accuracy.', 'Model variance is high across participants.', 'Run subject-level cross-validation and draft results table.', ['Python', 'Scikit-learn', 'Signal Processing'], 'Pending', undefined],
  ['progress-019', 'Edge ML for Wearable Health Sensors', 'Week of Feb 2, 2026', 9, 'Profiled TensorFlow Lite activity-recognition model on target hardware.', 'Measured latency and memory footprint across three quantization settings.', 'Power meter sampling was noisy.', 'Repeat power experiments and record demo video.', ['C', 'TensorFlow Lite', 'Linux'], 'Approved', 'Good measurement discipline.'],
  ['progress-020', 'Perception-Driven Grasp Planning', 'Week of Feb 2, 2026', 10, 'Implemented grasp-ranking features for cluttered tabletop simulation.', 'Raised simulated grasp success from 61 percent to 68 percent.', 'Scene generator overrepresents simple object shapes.', 'Add harder clutter distributions and prepare demo clip.', ['C++', 'Simulation', '3D Geometry'], 'Approved', 'Nice measurable improvement; add harder scenes next.'],
] satisfies Array<[
  string,
  string,
  string,
  number,
  string,
  string,
  string,
  string,
  string[],
  ProgressVerificationStatus,
  string | undefined,
]>;

function evidenceForReport(id: string, projectName: string): ProgressEvidenceLink[] {
  const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  return [
    {
      id: `${id}-repo`,
      type: 'GitHub Repo',
      url: `https://github.com/cmu-demo/${slug}`,
      description: 'Repository placeholder with scripts, configs, and README notes for the contribution.',
    },
    {
      id: `${id}-notebook`,
      type: 'Notebook',
      url: `https://cmu-demo.example.edu/evidence/${id}-analysis.ipynb`,
      description: 'Uploaded notebook placeholder documenting analysis, outputs, and reproducibility details.',
    },
  ];
}

// TODO: Replace this mock data with API-backed progress reports once backend persistence is added.
export const MOCK_PROGRESS_REPORTS: ProgressReport[] = reportSeeds.map(
  ([id, projectName, reportingPeriod, hoursWorked, tasksCompleted, resultsAchieved, challenges, nextSteps, skillsUsed, verificationStatus, professorComment], index) => ({
    id,
    projectName,
    reportingPeriod,
    hoursWorked,
    tasksCompleted,
    resultsAchieved,
    challenges,
    nextSteps,
    skillsUsed,
    evidenceLinks: evidenceForReport(id, projectName),
    verificationStatus,
    professorComment,
    submittedAt: new Date(Date.UTC(2026, 1, 7 + Math.floor(index / 2) * 7, 18, index % 2 === 0 ? 0 : 30)).toISOString(),
  })
);

export const PROGRESS_EVIDENCE_TYPES: ProgressEvidenceType[] = [
  'GitHub Repo',
  'Commit',
  'Pull Request',
  'Paper',
  'Dataset',
  'Notebook',
  'Presentation',
  'Demo Video',
  'Other',
];

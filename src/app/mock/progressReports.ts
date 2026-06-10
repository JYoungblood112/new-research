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

// TODO: Replace this mock data with API-backed progress reports once backend persistence is added.
export const MOCK_PROGRESS_REPORTS: ProgressReport[] = [
  {
    id: 'progress-001',
    projectName: 'Frame-Level Speech Recognition',
    reportingPeriod: 'Week of Jan 12, 2026',
    hoursWorked: 9,
    tasksCompleted:
      'Reviewed recent papers on MFCC feature extraction, frame stacking, and phoneme classification baselines.',
    resultsAchieved:
      'Created a literature summary with model choices, evaluation metrics, and dataset preprocessing risks.',
    challenges:
      'Several papers used incompatible phoneme label sets, so the comparison table needed normalization.',
    nextSteps:
      'Finalize preprocessing decisions and prepare the first training-ready dataset split.',
    skillsUsed: ['Literature Review', 'Machine Learning', 'Research Writing'],
    evidenceLinks: [
      {
        id: 'evidence-001',
        type: 'Paper',
        url: 'https://arxiv.org/abs/2306.00001',
        description: 'Reference paper summary used to compare speech recognition baselines.',
      },
      {
        id: 'evidence-002',
        type: 'Presentation',
        url: 'https://docs.google.com/presentation/d/example',
        description: 'Weekly lab update slides summarizing model tradeoffs.',
      },
    ],
    verificationStatus: 'Approved',
    professorComment: 'Clear synthesis of the model options. This is ready to include in the project portfolio.',
    submittedAt: '2026-01-16T15:30:00.000Z',
  },
  {
    id: 'progress-002',
    projectName: 'Frame-Level Speech Recognition',
    reportingPeriod: 'Week of Jan 19, 2026',
    hoursWorked: 12,
    tasksCompleted:
      'Cleaned audio metadata, aligned frame labels, and wrote scripts to validate missing or malformed records.',
    resultsAchieved:
      'Reduced unusable samples by identifying label mismatches and produced a reproducible cleaning notebook.',
    challenges:
      'Some recordings had inconsistent frame counts after feature extraction.',
    nextSteps:
      'Add automated checks to the preprocessing pipeline before model training.',
    skillsUsed: ['Python', 'SQL', 'Data Cleaning', 'Pandas'],
    evidenceLinks: [
      {
        id: 'evidence-003',
        type: 'Commit',
        url: 'https://github.com/student/speech-recognition/commit/abc123',
        description: 'Data validation commit for frame and phoneme alignment checks.',
      },
      {
        id: 'evidence-004',
        type: 'Notebook',
        url: 'https://github.com/student/speech-recognition/blob/main/notebooks/data-cleaning.ipynb',
        description: 'Notebook documenting data cleaning decisions and summary statistics.',
      },
    ],
    verificationStatus: 'Approved',
    professorComment: 'Good proof of contribution. The validation script is especially useful for the lab.',
    submittedAt: '2026-01-23T18:10:00.000Z',
  },
  {
    id: 'progress-003',
    projectName: 'Frame-Level Speech Recognition',
    reportingPeriod: 'Week of Jan 26, 2026',
    hoursWorked: 10,
    tasksCompleted:
      'Trained the first neural network baseline and compared frame-level accuracy across context window sizes.',
    resultsAchieved:
      'Baseline model reached 71% validation accuracy, with improved performance when temporal context was added.',
    challenges:
      'Training time increased sharply for larger context windows.',
    nextSteps:
      'Run ablations on batch size and hidden-layer width, then prepare a short results memo.',
    skillsUsed: ['PyTorch', 'Model Training', 'Experiment Tracking', 'Python'],
    evidenceLinks: [
      {
        id: 'evidence-005',
        type: 'Pull Request',
        url: 'https://github.com/student/speech-recognition/pull/7',
        description: 'Pull request adding the baseline training loop and experiment config.',
      },
      {
        id: 'evidence-006',
        type: 'Dataset',
        url: 'https://huggingface.co/datasets/example/speech-frame-demo',
        description: 'Dataset card draft for the cleaned experimental split.',
      },
    ],
    verificationStatus: 'Pending',
    submittedAt: '2026-01-30T20:05:00.000Z',
  },
];

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

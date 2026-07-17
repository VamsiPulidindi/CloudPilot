import fs from 'fs';
import path from 'path';

// Define the DB file path
const DB_DIR = process.env.DB_PATH || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Interface definitions
export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface QuestionnaireData {
  startupName: string;
  industry: string;
  projectType: string;
  expectedUsers: number;
  expectedGrowth: 'stable' | 'high' | 'explosive';
  budget: number;
  region: 'us-east' | 'eu-west' | 'ap-south';
  needAI: boolean;
  needKubernetes: boolean;
  needHighAvailability: boolean;
  storageRequirement: 'low' | 'medium' | 'high' | 'enterprise';
}

export interface Project {
  id: string;
  userId: string;
  startupName: string;
  industry: string;
  projectType: string;
  expectedUsers: number;
  expectedGrowth: 'stable' | 'high' | 'explosive';
  budget: number;
  region: 'us-east' | 'eu-west' | 'ap-south';
  needAI: boolean;
  needKubernetes: boolean;
  needHighAvailability: boolean;
  storageRequirement: 'low' | 'medium' | 'high' | 'enterprise';
  createdAt: string;
}

export interface ProviderBreakdown {
  cost: number;
  performance: number;
  scalability: number;
  easeOfUse: number;
  aiServices: number;
  kubernetes: number;
}

export interface RecommendationResult {
  providerName: string;
  overallScore: number;
  breakdown: ProviderBreakdown;
  estimatedCost: number;
  instanceType: string;
  pros: string[];
  cons: string[];
  whyNot: string;
  architecture: string;
}

export interface Evaluation {
  id: string;
  projectId: string;
  weights: {
    cost: number;
    performance: number;
    scalability: number;
    easeOfUse: number;
    aiServices: number;
    kubernetes: number;
  };
  recommendations: RecommendationResult[];
  createdAt: string;
}

interface DatabaseSchema {
  users: User[];
  projects: Project[];
  evaluations: Evaluation[];
  currentSessionUserId: string | null;
}

const initialDbData: DatabaseSchema = {
  users: [
    {
      id: "usr-admin",
      email: "vamsi@cloudpilot.co",
      username: "Vamsi Pulidindi",
      passwordHash: "pbkdf2_sha256$mockhash",
      createdAt: "2026-07-01T00:00:00Z"
    }
  ],
  projects: [
    {
      id: "proj-1",
      userId: "usr-admin",
      startupName: 'SaaS-Core-Backend',
      industry: 'Fintech',
      projectType: 'Microservices API',
      expectedUsers: 50000,
      expectedGrowth: 'high',
      budget: 1500,
      region: 'us-east',
      needAI: false,
      needKubernetes: true,
      needHighAvailability: true,
      storageRequirement: 'medium',
      createdAt: '2026-07-01'
    },
    {
      id: "proj-2",
      userId: "usr-admin",
      startupName: 'EdTech Streaming',
      industry: 'Education',
      projectType: 'Web Application',
      expectedUsers: 15000,
      expectedGrowth: 'stable',
      budget: 350,
      region: 'eu-west',
      needAI: false,
      needKubernetes: false,
      needHighAvailability: false,
      storageRequirement: 'high',
      createdAt: '2026-07-08'
    },
    {
      id: "proj-3",
      userId: "usr-admin",
      startupName: 'NeuroMed Diagnosis',
      industry: 'Healthcare',
      projectType: 'AI/ML Platform',
      expectedUsers: 5000,
      expectedGrowth: 'explosive',
      budget: 4500,
      region: 'ap-south',
      needAI: true,
      needKubernetes: true,
      needHighAvailability: true,
      storageRequirement: 'enterprise',
      createdAt: '2026-07-11'
    }
  ],
  evaluations: [
    {
      id: "eval-1",
      projectId: "proj-1",
      weights: { cost: 30, performance: 25, scalability: 15, easeOfUse: 10, aiServices: 10, kubernetes: 10 },
      recommendations: [
        {
          providerName: "AWS",
          overallScore: 84,
          breakdown: { cost: 73, performance: 96, scalability: 100, easeOfUse: 60, aiServices: 80, kubernetes: 90 },
          estimatedCost: 412,
          instanceType: "t3.medium / m5.large",
          pros: ["Unmatched service ecosystem", "Highest scaling capability", "Excellent multi-region high availability", "Compliance-ready"],
          cons: ["Complex pricing structures", "High learning curve", "Expensive support costs"],
          whyNot: "AWS is fully matched for large scale and robust requirements, whereas DigitalOcean is too basic for advanced microservices and Azure is overly complex.",
          architecture: "Route53 -> Application Load Balancer -> EKS Cluster -> RDS Aurora Multi-AZ"
        },
        {
          providerName: "Google Cloud Platform",
          overallScore: 79,
          breakdown: { cost: 68, performance: 92, scalability: 95, easeOfUse: 75, aiServices: 85, kubernetes: 98 },
          estimatedCost: 435,
          instanceType: "n2-standard-2",
          pros: ["Best GKE integration", "Vertex AI platforms", "Intuitive console layout"],
          cons: ["High enterprise pricing", "Slightly fewer region nodes"],
          whyNot: "Google Cloud is an outstanding alternative, but AWS services provide slightly better ecosystem synergy for fintech tooling.",
          architecture: "Cloud DNS -> Google Cloud Load Balancer -> GKE -> Cloud SQL"
        }
      ],
      createdAt: "2026-07-01T12:00:00Z"
    }
  ],
  currentSessionUserId: "usr-admin"
};

// Initialize DB file
function ensureDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDbData, null, 2), 'utf-8');
  }
}

export function readDb(): DatabaseSchema {
  ensureDb();
  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error("Failed to read NodeSQL Lite DB. Re-initializing...", err);
    return initialDbData;
  }
}

export function writeDb(data: DatabaseSchema) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

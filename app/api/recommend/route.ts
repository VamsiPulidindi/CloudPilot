import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb, Evaluation, RecommendationResult } from "@/lib/db";
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini client only if the key exists to avoid startup crashes
let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Deterministic rule-based fallback generator
function generateDeterministicRecommendations(
  projectData: any,
  weights: { cost: number; performance: number; scalability: number; easeOfUse: number; aiServices: number; kubernetes: number }
): RecommendationResult[] {
  const {
    startupName,
    projectType,
    expectedUsers,
    expectedGrowth,
    budget,
    needAI,
    needKubernetes,
    needHighAvailability,
    storageRequirement
  } = projectData;

  const providers = [
    { name: "AWS", baseCost: 150, perf: 95, scale: 98, ease: 60, ai: 85, k8s: 90 },
    { name: "Google Cloud Platform", baseCost: 160, perf: 90, scale: 95, ease: 75, ai: 98, k8s: 98 },
    { name: "Microsoft Azure", baseCost: 175, perf: 92, scale: 94, ease: 65, ai: 90, k8s: 85 },
    { name: "DigitalOcean", baseCost: 40, perf: 70, scale: 75, ease: 92, ai: 30, k8s: 70 }
  ];

  return providers.map(p => {
    // 1. Calculate Estimated Cost based on expected users, storage, k8s, AI, and provider premium
    let costMultiplier = 1.0;
    if (expectedGrowth === 'high') costMultiplier *= 1.3;
    if (expectedGrowth === 'explosive') costMultiplier *= 2.0;

    let userScale = expectedUsers / 10000;
    if (userScale < 0.1) userScale = 0.1;
    if (userScale > 10) userScale = 10;

    let cost = p.baseCost * costMultiplier * (1 + (userScale * 0.15));

    if (needKubernetes) cost += p.name === "DigitalOcean" ? 30 : 120;
    if (needAI) cost += p.name === "DigitalOcean" ? 10 : 180;
    if (needHighAvailability) cost *= 1.5;

    if (storageRequirement === 'high') cost += 40;
    if (storageRequirement === 'enterprise') cost += 200;

    // Round cost
    const finalCost = Math.round(cost);

    // 2. Adjust scores based on features
    let currentAI = p.ai;
    let currentK8s = p.k8s;
    let currentEase = p.ease;
    let currentScale = p.scale;
    let currentPerf = p.perf;

    // DigitalOcean penalty for high-end features
    if (needKubernetes && p.name === "DigitalOcean") {
      currentEase -= 10;
      currentK8s = 65;
    }
    if (needAI && p.name === "DigitalOcean") {
      currentAI = 20;
    }
    if (expectedGrowth === 'explosive' && p.name === "DigitalOcean") {
      currentScale -= 15;
    }

    // 3. Cost Score (Lower cost = higher cost-effectiveness score)
    let costScore = 100 - (finalCost / (budget || 500) * 40);
    if (costScore < 20) costScore = 20;
    if (costScore > 98) costScore = 98;
    // DigitalOcean gets a cost advantage
    if (p.name === "DigitalOcean") costScore = Math.min(99, costScore + 15);

    // 4. Weighted Score Calculation
    const totalWeights = weights.cost + weights.performance + weights.scalability + weights.easeOfUse + weights.aiServices + weights.kubernetes;
    const w = {
      cost: weights.cost / totalWeights,
      performance: weights.performance / totalWeights,
      scalability: weights.scalability / totalWeights,
      easeOfUse: weights.easeOfUse / totalWeights,
      aiServices: weights.aiServices / totalWeights,
      kubernetes: weights.kubernetes / totalWeights
    };

    const overallScore = Math.round(
      (costScore * w.cost) +
      (currentPerf * w.performance) +
      (currentScale * w.scalability) +
      (currentEase * w.easeOfUse) +
      (currentAI * w.aiServices) +
      (currentK8s * w.kubernetes)
    );

    // 5. Generate descriptive content
    let instanceType = "VM Instance";
    let pros: string[] = [];
    let cons: string[] = [];
    let whyNot = "";
    let architecture = "";

    if (p.name === "AWS") {
      instanceType = needKubernetes ? "m5.large (EKS Node) + t3.medium" : "t3.medium + RDS db.t3.medium";
      pros = ["Most mature cloud ecosystem with global edge reach", "Highly reliable multi-region high availability RDS/Aurora", "Excellent scaling capabilities with Auto Scaling Groups"];
      cons = ["Complex billing and potential cost overruns", "High learning curve and administrative overhead"];
      whyNot = "AWS is suited for robust enterprise scaling, but can be over-engineered for basic websites, making DigitalOcean a cheaper option for small workloads.";
      architecture = "Route 53 -> Application Load Balancer -> Elastic Beanstalk / EKS Cluster -> RDS Aurora PostgreSQL Multi-AZ -> S3 Bucket";
    } else if (p.name === "Google Cloud Platform") {
      instanceType = needKubernetes ? "n2-standard-2 (GKE Node)" : "e2-medium + Cloud SQL";
      pros = ["Industry-leading Kubernetes (GKE) management", "First-class serverless (Cloud Run) and AI/ML (Vertex AI)", "Sustained-use discounts are applied automatically"];
      cons = ["Slightly smaller community and less third-party SaaS integration than AWS", "Enterprise premium support costs can be prohibitive"];
      whyNot = "GCP is unmatched for AI workloads and GKE pipelines. However, if AI and container orchestration aren't core needs, AWS or DigitalOcean could save time and budget.";
      architecture = "Cloud DNS -> Cloud Load Balancing -> Cloud Run / GKE -> Cloud SQL (PostgreSQL) -> Cloud Storage";
    } else if (p.name === "Microsoft Azure") {
      instanceType = needKubernetes ? "Standard_D2s_v5 (AKS Node)" : "Standard_B2s + Azure SQL";
      pros = ["Seamless integration with Active Directory & enterprise networks", "Robust Azure Kubernetes Service (AKS)", "Favorable hybrid cloud architectures"];
      cons = ["Complex management console", "Licensing requirements can be restrictive"];
      whyNot = "Azure is ideal for Microsoft-aligned enterprise setups. For non-Microsoft startups, AWS is more universal and DigitalOcean is easier to operate.";
      architecture = "Azure Traffic Manager -> App Gateway -> AKS / App Services -> Azure SQL Multi-Region Replica";
    } else {
      instanceType = "Basic Premium Droplet (4GB RAM, 2 vCPUs)";
      pros = ["Predictable flat pricing with no hidden bandwidth charges", "Extremely clean, developer-friendly admin dashboard", "Excellent for rapid prototypes and MVP launches"];
      cons = ["Limited enterprise grade high-availability & failover setups", "Basic AI/ML toolchains and simpler managed services"];
      whyNot = "DigitalOcean is perfect for low-budget MVPs. For heavy workloads requiring EKS/GKE orchestration, high AI throughput, or geo-redundant DBs, AWS/GCP are preferred.";
      architecture = "DigitalOcean Load Balancer -> Droplets (managed by PM2/Docker) -> Managed PostgreSQL -> Spaces Object Storage";
    }

    return {
      providerName: p.name,
      overallScore: Math.min(100, Math.max(10, overallScore)),
      breakdown: {
        cost: Math.round(costScore),
        performance: Math.round(currentPerf),
        scalability: Math.round(currentScale),
        easeOfUse: Math.round(currentEase),
        aiServices: Math.round(currentAI),
        kubernetes: Math.round(currentK8s)
      },
      estimatedCost: finalCost,
      instanceType,
      pros,
      cons,
      whyNot,
      architecture
    };
  });
}

export async function POST(req: NextRequest) {
  try {
    const { projectId, weights } = await req.json();

    if (!projectId) {
      return NextResponse.json({ success: false, message: "Project ID is required." }, { status: 400 });
    }

    const db = readDb();
    const project = db.projects.find(p => p.id === projectId);

    if (!project) {
      return NextResponse.json({ success: false, message: "Project not found." }, { status: 404 });
    }

    const finalWeights = weights || { cost: 20, performance: 20, scalability: 20, easeOfUse: 20, aiServices: 10, kubernetes: 10 };

    let recommendations: RecommendationResult[] = [];
    let usedAI = false;

    // Attempt server-side Gemini API call
    const ai = getGeminiClient();
    if (ai) {
      try {
        const prompt = `
          You are CloudPilot AI, an elite Multi-Cloud Architect. Your job is to analyze startup requirements and generate detailed, highly accurate cloud provider evaluations and recommendations.
          
          Project Context:
          - Startup Name: ${project.startupName}
          - Industry: ${project.industry}
          - Core Architecture/Project Type: ${project.projectType}
          - Active Expected Users: ${project.expectedUsers}
          - Expected Growth Model: ${project.expectedGrowth}
          - Monthly Target Budget: $${project.budget}
          - Desired Deployment Region: ${project.region}
          - AI/ML features needed: ${project.needAI ? "YES" : "NO"}
          - Kubernetes required: ${project.needKubernetes ? "YES" : "NO"}
          - High Availability / Multi-AZ required: ${project.needHighAvailability ? "YES" : "NO"}
          - Storage scale: ${project.storageRequirement}

          Weight Priorities (Totaling 100% impact):
          - Cost Effectiveness weight: ${finalWeights.cost}
          - Performance weight: ${finalWeights.performance}
          - Scalability weight: ${finalWeights.scalability}
          - Ease of Use/Operational weight: ${finalWeights.easeOfUse}
          - AI/ML Native Integration weight: ${finalWeights.aiServices}
          - Kubernetes Ecosystem weight: ${finalWeights.kubernetes}

          Generate recommendation parameters for 4 cloud providers: AWS, Google Cloud Platform, Microsoft Azure, and DigitalOcean.
          For EACH provider, output:
          1. providerName (e.g. "AWS")
          2. overallScore (1-100, calculated dynamically based on weights and suitability)
          3. breakdown (cost, performance, scalability, easeOfUse, aiServices, kubernetes - scores from 1 to 100)
          4. estimatedCost (numeric, estimated realistic monthly billing including computed bandwidth, VM costs, and DB)
          5. instanceType (e.g., specific VM configurations and RDS choices matching the workload scale)
          6. pros (at least 2 solid pros)
          7. cons (at least 2 solid cons)
          8. whyNot (short architectural explanation comparing suitability vs others)
          9. architecture (clean textual visualization of the recommended deployment path, e.g. "Cloud DNS -> CDN -> Cloud Run -> Cloud SQL")

          Make sure the estimated costs are realistic (e.g., DigitalOcean should be lower, AWS/GCP should scale realistically based on users, storage and growth model, but should respect the budget scale if possible).
        `;

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              description: "List of cloud recommendations",
              items: {
                type: Type.OBJECT,
                required: ["providerName", "overallScore", "breakdown", "estimatedCost", "instanceType", "pros", "cons", "whyNot", "architecture"],
                properties: {
                  providerName: { type: Type.STRING },
                  overallScore: { type: Type.INTEGER },
                  breakdown: {
                    type: Type.OBJECT,
                    required: ["cost", "performance", "scalability", "easeOfUse", "aiServices", "kubernetes"],
                    properties: {
                      cost: { type: Type.INTEGER },
                      performance: { type: Type.INTEGER },
                      scalability: { type: Type.INTEGER },
                      easeOfUse: { type: Type.INTEGER },
                      aiServices: { type: Type.INTEGER },
                      kubernetes: { type: Type.INTEGER }
                    }
                  },
                  estimatedCost: { type: Type.INTEGER },
                  instanceType: { type: Type.STRING },
                  pros: { type: Type.ARRAY, items: { type: Type.STRING } },
                  cons: { type: Type.ARRAY, items: { type: Type.STRING } },
                  whyNot: { type: Type.STRING },
                  architecture: { type: Type.STRING }
                }
              }
            }
          }
        });

        const text = response.text;
        if (text) {
          recommendations = JSON.parse(text);
          // Sort recommendations by overallScore desc
          recommendations.sort((a, b) => b.overallScore - a.overallScore);
          usedAI = true;
        }
      } catch (aiErr) {
        console.error("Gemini recommendation query failed. Falling back to rules:", aiErr);
      }
    }

    // Fall back to rule engine if recommendations are empty
    if (recommendations.length === 0) {
      recommendations = generateDeterministicRecommendations(project, finalWeights);
      recommendations.sort((a, b) => b.overallScore - a.overallScore);
    }

    // Persist evaluation
    const newEvaluation: Evaluation = {
      id: `eval-${Date.now()}`,
      projectId,
      weights: finalWeights,
      recommendations,
      createdAt: new Date().toISOString()
    };

    // Remove existing evaluations for this project to keep DB size light and avoid infinite growth
    db.evaluations = db.evaluations.filter(e => e.projectId !== projectId);
    db.evaluations.push(newEvaluation);
    writeDb(db);

    return NextResponse.json({
      success: true,
      usedAI,
      evaluation: newEvaluation
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

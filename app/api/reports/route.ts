import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const format = searchParams.get("format") || "csv"; // csv or markdown

    if (!projectId) {
      return NextResponse.json({ success: false, message: "Project ID is required." }, { status: 400 });
    }

    const db = readDb();
    const project = db.projects.find(p => p.id === projectId);
    const evaluation = db.evaluations.find(e => e.projectId === projectId);

    if (!project || !evaluation) {
      return NextResponse.json({ success: false, message: "Project or Evaluation data not found." }, { status: 404 });
    }

    if (format === "csv") {
      // Build a clean CSV
      const headers = [
        "Startup Name",
        "Cloud Provider",
        "Overall Score",
        "Estimated Cost ($/mo)",
        "Instance Type",
        "Cost Score",
        "Performance Score",
        "Scalability Score",
        "Ease of Use Score",
        "AI Score",
        "Kubernetes Score",
        "Pros",
        "Cons",
        "Recommended Architecture"
      ];

      const rows = evaluation.recommendations.map(r => [
        `"${project.startupName}"`,
        `"${r.providerName}"`,
        r.overallScore,
        r.estimatedCost,
        `"${r.instanceType.replace(/"/g, '""')}"`,
        r.breakdown.cost,
        r.breakdown.performance,
        r.breakdown.scalability,
        r.breakdown.easeOfUse,
        r.breakdown.aiServices,
        r.breakdown.kubernetes,
        `"${r.pros.join(' | ').replace(/"/g, '""')}"`,
        `"${r.cons.join(' | ').replace(/"/g, '""')}"`,
        `"${r.architecture.replace(/"/g, '""')}"`
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.join(","))
      ].join("\n");

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=CloudPilot-Report-${project.startupName.replace(/\s+/g, '-')}.csv`
        }
      });
    }

    if (format === "markdown") {
      // Build an elegant printable Markdown report
      let md = `# CloudPilot Multi-Cloud Evaluation Report\n\n`;
      md += `**Startup:** ${project.startupName}\n`;
      md += `**Industry/Type:** ${project.industry} - ${project.projectType}\n`;
      md += `**Region & Scale:** ${project.region} | ${project.expectedUsers.toLocaleString()} Users (${project.expectedGrowth} growth)\n`;
      md += `**Budget Goal:** $${project.budget}/month\n`;
      md += `**Generated At:** ${new Date(evaluation.createdAt).toUTCString()}\n\n`;

      md += `## Cloud Provider Rankings\n\n`;
      evaluation.recommendations.forEach((r, idx) => {
        md += `### ${idx + 1}. ${r.providerName} (Score: ${r.overallScore}/100)\n`;
        md += `- **Estimated Cost:** $${r.estimatedCost}/month\n`;
        md += `- **Recommended Configuration:** \`${r.instanceType}\`\n`;
        md += `- **Scores:** Cost: ${r.breakdown.cost} | Perf: ${r.breakdown.performance} | Scale: ${r.breakdown.scalability} | Ease: ${r.breakdown.easeOfUse} | AI: ${r.breakdown.aiServices} | K8s: ${r.breakdown.kubernetes}\n\n`;
        
        md += `#### Pros\n`;
        r.pros.forEach(p => md += `- ${p}\n`);
        md += `\n#### Cons\n`;
        r.cons.forEach(c => md += `- ${c}\n`);
        
        md += `\n#### Recommended Architecture\n`;
        md += `\`\`\`\n${r.architecture}\n\`\`\`\n`;
        md += `\n*Comparison Insight:* ${r.whyNot}\n\n`;
        md += `---\n\n`;
      });

      return NextResponse.json({ success: true, markdown: md });
    }

    return NextResponse.json({ success: false, message: "Invalid format requested." }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

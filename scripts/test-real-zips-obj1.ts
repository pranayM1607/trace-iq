import fs from 'fs';
import { analyzeCodebaseZip } from '../src/engine/codebaseAnalyzer';

async function testZip(zipPath: string, name: string) {
  console.log(`\n========================================`);
  console.log(`TESTING: ${name}`);
  console.log(`Path: ${zipPath}`);
  
  if (!fs.existsSync(zipPath)) {
    console.log(`File not found: ${zipPath}`);
    return;
  }
  
  const buffer = fs.readFileSync(zipPath);
  const result = await analyzeCodebaseZip(buffer as any);
  
  console.log(`Analysis success: ${result.success}`);
  console.log(`Files scanned (retention): ${result.filesScanned}`);
  console.log(`Inventory Total Files: ${result.inventory?.total_files}`);
  console.log(`Inventory Total Folders: ${result.inventory?.total_folders}`);
  console.log(`Inventory File Categories:`, result.inventory?.categories_breakdown);
  console.log(`Inventory Languages:`, result.inventory?.languages);
  console.log(`Inventory File Dependencies: ${result.inventory?.file_dependencies.length}`);
  console.log(`Is Limited Architecture: ${result.isLimitedArchitecture} (${result.limitedArchitectureReason || 'None'})`);
  console.log(`Entities detected (${result.entities.length}):`);
  result.entities.forEach(e => console.log(`  - [${e.type}] ${e.name} (${e.technology}) id=${e.id}`));
  console.log(`Relationships detected (${result.relationships.length}):`);
  result.relationships.forEach(r => console.log(`  - ${r.source} -[${r.type}]-> ${r.target} (${r.protocol}) [${r.sourceEvidence?.confidence}]`));
  console.log(`Manifests found: ${result.manifestsFound.join(', ') || 'None'}`);
}

async function main() {
  await testZip('C:\\Users\\prana\\Downloads\\phishing-ai-extention-main (1).zip', 'Phishing AI Extension');
  await testZip('C:\\Users\\prana\\Downloads\\AI-Customer-Feedback-Analyzer-main.zip', 'AI Customer Feedback Analyzer');
  await testZip('C:\\Users\\prana\\Downloads\\RAG-Research-Assistant-main.zip', 'RAG Research Assistant');
}

main().catch(console.error);

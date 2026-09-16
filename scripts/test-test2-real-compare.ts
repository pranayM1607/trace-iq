import fs from 'fs';
import { compareRealInputs } from './src/engine/directCompareEngine';

async function testRealZipCompare() {
  const p1 = 'C:\\Users\\prana\\Desktop\\wallpapers\\Test2-main - Copy.zip';
  const p2 = 'C:\\Users\\prana\\Desktop\\wallpapers\\Test2-main.zip';

  const buf1 = fs.readFileSync(p1);
  const buf2 = fs.readFileSync(p2);

  const file1 = new File([buf1], 'Test2-main - Copy.zip', { type: 'application/zip' });
  const file2 = new File([buf2], 'Test2-main.zip', { type: 'application/zip' });

  console.log('Running compareRealInputs on real files:');
  console.log('  Orig:', file1.name, `(${file1.size} bytes)`);
  console.log('  Chg:', file2.name, `(${file2.size} bytes)`);

  const result = await compareRealInputs(file1, file2);

  console.log('\n=== COMPARISON RESULT ===');
  console.log('Original Identity:', result.originalIdentity);
  console.log('Changed Identity:', result.changedIdentity);

  console.log('\nOriginal Entities Count:', result.originalModel.entities.length);
  console.log('Changed Entities Count:', result.changedModel.entities.length);

  console.log('\nOriginal Inventory Files Count:', result.originalModel.inventory?.files?.length);
  console.log('Changed Inventory Files Count:', result.changedModel.inventory?.files?.length);

  console.log('\nRepository Diff Summary:', result.repositoryDiff?.summary);
  console.log('Architecture Diff Summary:', result.architectureDiff.summary);

  if (result.repositoryDiff?.diffFiles) {
    console.log('\nDiff Files Count:', result.repositoryDiff.diffFiles.length);
    const added = result.repositoryDiff.diffFiles.filter((f) => f.changeType === 'added');
    const removed = result.repositoryDiff.diffFiles.filter((f) => f.changeType === 'removed');
    const modified = result.repositoryDiff.diffFiles.filter((f) => f.changeType === 'modified');
    const unchanged = result.repositoryDiff.diffFiles.filter((f) => f.changeType === 'unchanged');

    console.log(`Added (${added.length}):`, added.map((f) => f.file.path));
    console.log(`Removed (${removed.length}):`, removed.map((f) => f.file.path));
    console.log(`Modified (${modified.length}):`, modified.map((f) => f.file.path));
    console.log(`Unchanged (${unchanged.length}):`, unchanged.length);
  }
}

testRealZipCompare().catch(console.error);

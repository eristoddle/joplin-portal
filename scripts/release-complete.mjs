#!/usr/bin/env node

import { execSync } from "child_process";
import { readFileSync } from "fs";

/**
 * Complete release automation script
 * Runs the full release process with user confirmation
 */

const args = process.argv.slice(2);
const versionType = args[0] || 'patch';

console.log('🚀 Starting complete release process...');
console.log(`Version bump type: ${versionType}`);

// Function to run command and handle errors
function runCommand(command, description) {
  console.log(`\n📋 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} completed`);
  } catch (error) {
    console.error(`❌ ${description} failed`);
    process.exit(1);
  }
}

// Function to get user confirmation
function getUserConfirmation(message) {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    readline.question(`${message} (y/N): `, (answer) => {
      readline.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  try {
    // Step 1: Run tests
    console.log('\n🧪 Step 1: Running tests...');
    const runTests = await getUserConfirmation('Run tests before release?');
    if (runTests) {
      runCommand('npm test', 'Running test suite');
    }

    // Step 2: Version bump
    console.log('\n📈 Step 2: Version bump...');
    runCommand(`node scripts/version-bump.mjs ${versionType}`, 'Bumping version');

    // Get new version
    const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
    const newVersion = manifest.version;
    console.log(`New version: ${newVersion}`);

    // Step 3: Generate changelog
    console.log('\n📝 Step 3: Generating changelog...');
    const generateChangelog = await getUserConfirmation('Generate changelog from git commits?');
    if (generateChangelog) {
      runCommand(`node scripts/generate-changelog.mjs ${newVersion}`, 'Generating changelog');

      console.log('\n📖 Please review the generated changelog and make any necessary edits.');
      const continueAfterChangelog = await getUserConfirmation('Continue with release?');
      if (!continueAfterChangelog) {
        console.log('Release cancelled. You can resume later with: npm run release');
        process.exit(0);
      }
    }

    // Step 4: Build and prepare release
    console.log('\n🔨 Step 4: Building release...');
    runCommand('npm run release', 'Building and preparing release package');

    // Step 5: Git operations
    console.log('\n📦 Step 5: Git operations...');
    const commitAndTag = await getUserConfirmation('Commit changes and create git tag?');
    if (commitAndTag) {
      runCommand('git add .', 'Staging changes');
      runCommand(`git commit -m "chore: release v${newVersion}"`, 'Committing changes');
      runCommand(`git tag v${newVersion}`, 'Creating git tag');

      const pushChanges = await getUserConfirmation('Push changes and tags to remote?');
      if (pushChanges) {
        runCommand('git push origin main', 'Pushing changes');
        runCommand('git push --tags', 'Pushing tags');
      }
    }

    // Step 6: Final instructions
    console.log('\n🎉 Release process completed successfully!');
    console.log(`\n📋 Next steps:`);
    console.log(`1. Go to GitHub repository releases page`);
    console.log(`2. Create new release for tag v${newVersion}`);
    console.log(`3. Use content from release-notes-${newVersion}.md as description`);
    console.log(`4. Attach files from releases/v${newVersion}/ directory`);
    console.log(`5. Publish the release`);

    console.log(`\n📁 Release files location: releases/v${newVersion}/`);
    console.log(`📄 Release notes: release-notes-${newVersion}.md`);

  } catch (error) {
    console.error('\n❌ Release process failed:', error.message);
    process.exit(1);
  }
}

main();
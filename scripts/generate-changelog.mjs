#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";

/**
 * Changelog generation script for Obsidian plugin
 * Generates changelog from git commits and updates CHANGELOG.md
 */

const args = process.argv.slice(2);
const targetVersion = args[0];

if (!targetVersion) {
  console.error('Usage: node generate-changelog.mjs <version>');
  console.error('Example: node generate-changelog.mjs 1.2.0');
  process.exit(1);
}

console.log(`📝 Generating changelog for version ${targetVersion}...`);

// Check if we're in a git repository
try {
  execSync('git rev-parse --git-dir', { stdio: 'ignore' });
} catch (error) {
  console.error('❌ Not in a git repository');
  process.exit(1);
}

// Get the latest tag to determine commit range
let previousTag;
try {
  previousTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
  console.log(`Previous tag: ${previousTag}`);
} catch (error) {
  console.log('No previous tags found, using all commits');
  previousTag = null;
}

// Get commits since last tag
const commitRange = previousTag ? `${previousTag}..HEAD` : 'HEAD';
let commits;

try {
  const gitLog = execSync(
    `git log ${commitRange} --pretty=format:"%h|%s|%an|%ad" --date=short`,
    { encoding: 'utf8' }
  );

  commits = gitLog.split('\n')
    .filter(line => line.trim())
    .map(line => {
      const [hash, subject, author, date] = line.split('|');
      return { hash, subject, author, date };
    });

} catch (error) {
  console.log('No new commits found');
  commits = [];
}

console.log(`Found ${commits.length} commits since ${previousTag || 'beginning'}`);

// Categorize commits
const categories = {
  features: [],
  fixes: [],
  improvements: [],
  breaking: [],
  other: []
};

commits.forEach(commit => {
  const subject = commit.subject.toLowerCase();

  if (subject.includes('breaking') || subject.startsWith('!')) {
    categories.breaking.push(commit);
  } else if (subject.startsWith('feat') || subject.includes('add') || subject.includes('new')) {
    categories.features.push(commit);
  } else if (subject.startsWith('fix') || subject.includes('bug') || subject.includes('error')) {
    categories.fixes.push(commit);
  } else if (subject.startsWith('improve') || subject.startsWith('enhance') || subject.startsWith('update')) {
    categories.improvements.push(commit);
  } else if (!subject.startsWith('chore') && !subject.startsWith('docs') && !subject.startsWith('test')) {
    categories.other.push(commit);
  }
});

// Generate changelog content
const date = new Date().toISOString().split('T')[0];
let changelogContent = `## [${targetVersion}] - ${date}\n\n`;

if (categories.breaking.length > 0) {
  changelogContent += '### ⚠️ Breaking Changes\n\n';
  categories.breaking.forEach(commit => {
    changelogContent += `- ${commit.subject} ([${commit.hash}])\n`;
  });
  changelogContent += '\n';
}

if (categories.features.length > 0) {
  changelogContent += '### ✨ New Features\n\n';
  categories.features.forEach(commit => {
    changelogContent += `- ${commit.subject} ([${commit.hash}])\n`;
  });
  changelogContent += '\n';
}

if (categories.improvements.length > 0) {
  changelogContent += '### 🚀 Improvements\n\n';
  categories.improvements.forEach(commit => {
    changelogContent += `- ${commit.subject} ([${commit.hash}])\n`;
  });
  changelogContent += '\n';
}

if (categories.fixes.length > 0) {
  changelogContent += '### 🐛 Bug Fixes\n\n';
  categories.fixes.forEach(commit => {
    changelogContent += `- ${commit.subject} ([${commit.hash}])\n`;
  });
  changelogContent += '\n';
}

if (categories.other.length > 0) {
  changelogContent += '### 📝 Other Changes\n\n';
  categories.other.forEach(commit => {
    changelogContent += `- ${commit.subject} ([${commit.hash}])\n`;
  });
  changelogContent += '\n';
}

// Add contributors
const contributors = [...new Set(commits.map(c => c.author))];
if (contributors.length > 0) {
  changelogContent += '### 👥 Contributors\n\n';
  contributors.forEach(contributor => {
    changelogContent += `- ${contributor}\n`;
  });
  changelogContent += '\n';
}

// Read existing changelog or create header
let existingChangelog = '';
if (existsSync('CHANGELOG.md')) {
  existingChangelog = readFileSync('CHANGELOG.md', 'utf8');

  // Remove the header if it exists to avoid duplication
  const headerEnd = existingChangelog.indexOf('\n## ');
  if (headerEnd > 0) {
    existingChangelog = existingChangelog.substring(headerEnd + 1);
  }
} else {
  console.log('Creating new CHANGELOG.md');
}

// Create full changelog
const fullChangelog = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

${changelogContent}${existingChangelog}`;

// Write changelog
writeFileSync('CHANGELOG.md', fullChangelog);
console.log('✓ Updated CHANGELOG.md');

// Generate release notes for GitHub
const releaseNotes = changelogContent.trim();
writeFileSync(`release-notes-${targetVersion}.md`, releaseNotes);
console.log(`✓ Created release-notes-${targetVersion}.md`);

console.log(`\n📋 Changelog Summary:`);
console.log(`   Breaking Changes: ${categories.breaking.length}`);
console.log(`   New Features: ${categories.features.length}`);
console.log(`   Improvements: ${categories.improvements.length}`);
console.log(`   Bug Fixes: ${categories.fixes.length}`);
console.log(`   Other Changes: ${categories.other.length}`);
console.log(`   Contributors: ${contributors.length}`);

console.log(`\n🎉 Changelog generated successfully!`);
console.log(`   Updated: CHANGELOG.md`);
console.log(`   Release notes: release-notes-${targetVersion}.md`);
#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

const MAX_LINE_WIDTH = 80;

function printUsage() {
  console.error('Usage: node scripts/format-md-tables.mjs <file.md> [--write]');
}

function splitTableRow(line) {
  let text = line.trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|')) text = text.slice(0, -1);

  const cells = [];
  let current = '';
  let escaped = false;

  for (const char of text) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      current += char;
      escaped = true;
      continue;
    }
    if (char === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function isSeparatorCell(cell) {
  return /^:?-+:?$/.test(cell.trim());
}

function isSeparatorRow(line) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every(isSeparatorCell);
}

function isTableCandidate(line) {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return false;
  if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) return false;
  return true;
}

function inferAlignment(cell) {
  const trimmed = cell.trim();
  return {
    left: trimmed.startsWith(':'),
    right: trimmed.endsWith(':'),
  };
}

function wrapCellContent(cell, widthBudget) {
  const trimmed = cell.trim().replaceAll('<br>', ', ');
  if (trimmed.length <= widthBudget) return [trimmed];
  if (!trimmed.includes(', ')) return [trimmed];

  const parts = trimmed.split(', ');
  const lines = [];
  let current = '';

  for (const part of parts) {
    const candidate = current ? `${current}, ${part}` : part;
    if (candidate.length <= widthBudget || current === '') {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = part;
  }

  if (current) lines.push(current);
  return lines;
}

function makeSeparator(width, alignment) {
  const dashes = '-'.repeat(Math.max(3, width));
  if (alignment.left && alignment.right) return `:${dashes}:`;
  if (alignment.left) return `:${dashes}`;
  if (alignment.right) return `${dashes}:`;
  return dashes;
}

function padCell(cell, width, alignment) {
  const trimmed = cell.trim();
  if (alignment.right && !alignment.left) {
    return trimmed.padStart(width, ' ');
  }
  if (alignment.left && alignment.right) {
    const total = width - trimmed.length;
    const left = Math.floor(total / 2);
    const right = total - left;
    return `${' '.repeat(Math.max(0, left))}${trimmed}${' '.repeat(Math.max(0, right))}`;
  }
  return trimmed.padEnd(width, ' ');
}

function formatTableBlock(lines) {
  const rows = lines.map(splitTableRow);
  const columnCount = Math.max(...rows.map((row) => row.length));
  const wrappedRows = rows.map((row, rowIndex) => row.map((cell) => {
    if (rowIndex <= 1) return [cell];
    const widthBudget = Math.max(18, MAX_LINE_WIDTH - columnCount * 4);
    return wrapCellContent(cell, widthBudget);
  }));
  const normalizedRows = wrappedRows.map((row) =>
    row.concat(Array.from({ length: columnCount - row.length }, () => ['']))
  );
  const expandedRows = [];

  for (let rowIndex = 0; rowIndex < normalizedRows.length; rowIndex += 1) {
    const row = normalizedRows[rowIndex];
    if (rowIndex === 1) {
      expandedRows.push(row.map((cellParts) => cellParts[0] ?? ''));
      continue;
    }

    const height = Math.max(...row.map((cellParts) => cellParts.length));
    for (let lineIndex = 0; lineIndex < height; lineIndex += 1) {
      expandedRows.push(row.map((cellParts) => cellParts[lineIndex] ?? ''));
    }
  }

  const alignments = expandedRows[1].map(inferAlignment);
  const widths = Array.from({ length: columnCount }, (_, col) => {
    let width = 3;
    for (let rowIndex = 0; rowIndex < expandedRows.length; rowIndex += 1) {
      if (rowIndex === 1) continue;
      width = Math.max(width, expandedRows[rowIndex][col].trim().length);
    }
    const sepWidth = makeSeparator(3, alignments[col]).length;
    return Math.max(width, sepWidth);
  });

  return expandedRows.map((row, rowIndex) => {
    if (rowIndex === 1) {
      const cells = row.map((_, col) => makeSeparator(widths[col], alignments[col]));
      return `| ${cells.join(' | ')} |`;
    }
    const cells = row.map((cell, col) => padCell(cell, widths[col], alignments[col]));
    return `| ${cells.join(' | ')} |`;
  });
}

function formatMarkdownTables(source) {
  const lines = source.split('\n');
  const output = [];
  let i = 0;
  let inFence = false;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFence = !inFence;
      output.push(line);
      i += 1;
      continue;
    }

    if (
      !inFence &&
      i + 1 < lines.length &&
      isTableCandidate(line) &&
      isSeparatorRow(lines[i + 1])
    ) {
      const block = [line, lines[i + 1]];
      i += 2;
      while (i < lines.length && !inFence && isTableCandidate(lines[i])) {
        if (lines[i].trim() === '') break;
        block.push(lines[i]);
        i += 1;
      }
      output.push(...formatTableBlock(block));
      continue;
    }

    output.push(line);
    i += 1;
  }

  return output.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const file = args.find((arg) => !arg.startsWith('--'));

  if (!file) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  const source = await readFile(file, 'utf8');
  const formatted = formatMarkdownTables(source);

  if (write) {
    if (formatted !== source) {
      await writeFile(file, formatted, 'utf8');
    }
    return;
  }

  process.stdout.write(formatted);
}

await main();

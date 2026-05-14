const { prisma } = require('../src/db');

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function inspectModel(label, delegate, fallbackPrefix, write) {
  const rows = await delegate.findMany({ orderBy: { updatedAt: 'desc' } });
  const desired = rows.map((row) => ({
    id: row.id,
    title: row.title || '',
    current: row.slug || '',
    next: slugify(row.slug || row.title || `${fallbackPrefix}-${row.id}`)
  }));

  const conflicts = new Map();
  for (const row of desired) {
    if (!row.next) row.next = `${fallbackPrefix}-${row.id}`;
    const bucket = conflicts.get(row.next) || [];
    bucket.push(row);
    conflicts.set(row.next, bucket);
  }

  const unsafe = [...conflicts.entries()].filter(([, bucket]) => bucket.length > 1);
  if (unsafe.length) {
    console.log(`\n${label}: conflicts found. No ${label} rows will be changed.`);
    for (const [slug, bucket] of unsafe) {
      console.log(`- ${slug}: ${bucket.map((row) => `${row.title || row.id} (${row.id})`).join(', ')}`);
    }
    return { changed: 0, skipped: rows.length, conflicts: unsafe.length };
  }

  const changes = desired.filter((row) => row.current !== row.next);
  console.log(`\n${label}: ${changes.length} slug${changes.length === 1 ? '' : 's'} need repair.`);
  for (const row of changes) {
    console.log(`- ${row.title || row.id}: "${row.current}" -> "${row.next}"`);
  }

  if (write) {
    for (const row of changes) {
      await delegate.update({ where: { id: row.id }, data: { slug: row.next } });
    }
  }

  return { changed: changes.length, skipped: rows.length - changes.length, conflicts: 0 };
}

async function main() {
  const write = process.argv.includes('--write');
  console.log(write ? 'Repair mode: writing safe slug changes.' : 'Dry run: no database changes will be made. Pass --write to repair safe rows.');

  const updates = await inspectModel('Updates', prisma.update, 'update', write);
  const resources = await inspectModel('Resources', prisma.resource, 'resource', write);

  console.log('\nSummary');
  console.log(`Updates: ${updates.changed} change(s), ${updates.conflicts} conflict group(s).`);
  console.log(`Resources: ${resources.changed} change(s), ${resources.conflicts} conflict group(s).`);

  if (updates.conflicts || resources.conflicts) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

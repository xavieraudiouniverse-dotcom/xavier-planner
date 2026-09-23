import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const model=readFileSync(new URL('./model.ts',import.meta.url),'utf8');
assert.match(model,/export function descendants/);
assert.match(model,/export function progress/);
assert.match(model,/export function matchesPeriod/);
assert.match(model,/export function getSuggestedSteps/);
console.log('Planner core source checks passed.');

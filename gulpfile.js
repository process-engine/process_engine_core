'use strict';

const gulptraum = require('gulptraum');
const gulptraumTypescriptPlugin = require('gulptraum-typescript');
const tsconfig = require('tsconfig');

const buildSystemConfig = {
  suppressErrorsForTasks: ['lint'],
};

const buildSystem = new gulptraum.BuildSystem(buildSystemConfig);

buildSystem.config = buildSystemConfig;

const tsConfigObj = tsconfig.loadSync('.');

const typeScriptConfig = Object.assign({
  compileToModules: ['commonjs', 'amd']
}, tsConfigObj.config);

const gulp = require('gulp');

buildSystem
  .registerPlugin('typescript', gulptraumTypescriptPlugin, typeScriptConfig)
  .registerTasks(gulp);

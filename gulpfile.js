'use strict';

const gulptraum = require('gulptraum');
const tsconfig = require('tsconfig');

const buildSystemConfig = {};

const buildSystem = new gulptraum.BuildSystem(buildSystemConfig);

buildSystem.config = buildSystemConfig;

const tsConfigObj = tsconfig.loadSync('.');

const typeScriptConfig = Object.assign({
  compileToModules: ['commonjs']
}, tsConfigObj.config);

const gulp = require('gulp');

buildSystem
  .registerPlugin('typescript', gulptraum.plugins.typescript, typeScriptConfig)
  .registerTasks(gulp);

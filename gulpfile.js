'use strict';

const gulptraum = require('gulptraum');

const buildSystemConfig = {
};

const buildSystem = new gulptraum.BuildSystem(buildSystemConfig);

buildSystem.config = buildSystemConfig;

const typeScriptConfig = {
  compileToModules: ['commonjs'],
};

const gulp = require('gulp');

buildSystem
  .registerPlugin('typescript', gulptraum.plugins.typescript, typeScriptConfig)
  .registerTasks(gulp);

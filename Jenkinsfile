#!/usr/bin/env groovy

/*
 * Template Jenkinsfile for process-engine projects.
 *
 * For this template to work you need some custom
 * scripts in your package.json. Below is a example
 * for those scripts:
 *  (...)
 *  "scripts": {
 *    "lint": "gulp lint",
 *    "build": "gulp build",
 *    "build-schemas": "gulp typescript-schema"
 *    "build-doc": "gulp doc",
 *    "test": "gulp test",
 *  },
 *  (...)
 *
 */
pipeline {
  agent any
  tools {
    nodejs "node-lts"
  }

  stages {
    stage('prepare') {
      steps {
        sh 'node --version'
        sh 'npm install --ignore-scripts'
      }
    }
    stage('lint') {
      steps {
        sh 'node --version'
        /* we do not want the linting to cause a failed build */
        sh 'npm run lint || true'
      }
    }
    stage('build') {
      steps {
        sh 'node --version'
        sh 'npm run build'
        sh 'npm run build-schemas'
        sh 'npm run build-doc'
      }
    }
    stage('test') {
      steps {
        sh 'node --version'
        sh 'npm run test'
      }
    }
    stage('publish') {
      // Check if the build is trigged by a new git commit;
      // if this is a new commit, publish to NPM.
      when {
        allOf {
          branch 'master'
          expression {
            env.GIT_PREVIOUS_COMMIT != env.GIT_COMMIT
          }
        }
      }
      steps {
        nodejs(configId: 'process-engine-ci-token', nodeJSInstallationName: 'node-lts') {
          sh 'node --version'
          sh 'npm publish --ignore-scripts'
        }
      }
    }
  }
}

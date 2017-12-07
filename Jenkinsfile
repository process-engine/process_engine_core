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
    nodejs "node-v7"
  }

  stages {
    stage('prepare') {
      steps {
        sh 'npm install --ignore-scripts'
      }
    }
    stage('lint') {
      steps {
        sh 'npm run lint || true'
      }
    }
    stage('build') {
      steps {
        sh 'npm run build'
        sh 'npm run build-schemas'
        sh 'npm run build-doc'
      }
    }
    stage('test') {
      steps {
        sh 'npm run test'
      }
    }
  }
}

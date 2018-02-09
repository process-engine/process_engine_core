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
  environment {
    NPM_RC_FILE = 'process-engine-ci-token'
    NODE_JS_VERSION = 'node-lts'
  }

  stages {
    stage('prepare') {
      steps {
        script {
          rawPackageVersion = sh returnStdout: true, script: 'node --print --eval "require(\'./package.json\').version"'
          packageVersion = rawPackageVersion.trim()
          echo "Package version is '" + packageVersion + "'"
        }
        nodejs(configId: env.NPM_RC_FILE, nodeJSInstallationName: env.NODE_JS_VERSION) {
          sh 'node --version'
          sh 'npm install --ignore-scripts'
        }
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
      steps {
        script {
          def branch = env.BRANCH_NAME;
          def branch_is_master = branch == 'master';
          def new_commit = env.GIT_PREVIOUS_COMMIT != env.GIT_COMMIT;

          if (branch_is_master) {
            if (new_commit) {
              script {
                // let the build fail if the version does not match normal semver
                def semver_matcher = packageVersion =~ /\d+\.\d+\.\d+/;
                def is_version_not_semver = semver_matcher.matches() == false;
                if (is_version_not_semver) {
                  error('Only non RC Versions are allowed in master')
                }
              }

              nodejs(configId: env.NPM_RC_FILE, nodeJSInstallationName: env.NODE_JS_VERSION) {
                sh 'node --version'
                sh 'npm publish --ignore-scripts'
              }
            }

          } else {
            // when not on master, publish a prerelease based on the package version, the
            // current git commit and the build number.
            // the published version gets tagged as the branch name.
            def first_seven_digits_of_git_hash = env.GIT_COMMIT.substring(0, 8);
            def publish_version = "${packageVersion}-${first_seven_digits_of_git_hash}-b${env.BUILD_NUMBER}";
            def publish_tag = branch.replace("/", "~");

            nodejs(configId: env.NPM_RC_FILE, nodeJSInstallationName: env.NODE_JS_VERSION) {
              sh 'node --version'
              sh "npm version ${publish_version} --no-git-tag-version --force"
              sh "npm publish --tag ${publish_tag} --ignore-scripts"
            }
          }
        }
      }
    }
  }
}

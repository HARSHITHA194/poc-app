// Declarative pipeline matching the POC workflow:
// Push to GitHub -> Jenkins polls GitHub -> Build -> Test -> Security/quality (+ quality gate)
// -> Docker image -> (optional image scan) -> Registry
// -> update image tag in the Kubernetes (GitOps) repo -> Argo CD syncs the cluster.
pipeline {
  agent any

  environment {
    REGISTRY        = 'docker.io/harshitha1904'          // e.g. Azure Container Registry or docker.io/youruser
    IMAGE_NAME      = 'poc-web'
    IMAGE_TAG       = "${env.BUILD_NUMBER}"
    REGISTRY_CREDS  = 'registry-credentials'              // Jenkins credentials ID (username/password)
    GIT_CREDS       = 'github-credentials'                // Jenkins credentials ID (username + PAT)
    K8S_REPO        = 'github.com/HARSHITHA194/poc-k8s-config.git'

    // ---- Quality switches ----
    GATE_ENFORCE    = 'false'   // 'true' = a failed quality check stops the pipeline (nothing is deployed)
    ENABLE_SEMGREP  = 'false'   // 'true' = extra security rules (many rules, uses ~0.5 GB RAM while running)
    ENABLE_TRIVY    = 'false'   // 'true' = scan the built Docker image (downloads a database, uses extra RAM)
  }

  triggers {
    pollSCM('* * * * *')   // Jenkins asks GitHub for new commits every minute (no webhook: Jenkins runs locally)
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Build application') {
      steps {
        dir('app') {
          sh 'python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt'
        }
      }
    }

    stage('Run tests') {
      steps {
        dir('app') {
          sh '. .venv/bin/activate && pytest -q'
        }
      }
    }

    stage('Security / quality checks') {
      steps {
        dir('app') {
          sh '''
            set +x
            . .venv/bin/activate
            pip install --quiet bandit pip-audit flake8 pylint radon xenon pytest-cov

            GATE_FAILED=0
            gate() { "$@" || { echo ">>> QUALITY CHECK FAILED: $*"; GATE_FAILED=1; }; }

            echo "=== bandit: security issues in code (B104 skipped: servers in containers must listen on 0.0.0.0) ==="
            gate bandit -r app.py -ll -s B104

            echo "=== pip-audit: vulnerable libraries ==="
            gate pip-audit -r requirements.txt

            echo "=== flake8: code style ==="
            gate sh -c 'flake8 app.py --max-line-length=120 > flake8.txt'
            cat flake8.txt

            echo "=== pylint: bugs and code smells (must score 7/10 or more) ==="
            gate sh -c 'pylint app.py --fail-under=7 --output-format=parseable > pylint.txt'
            cat pylint.txt

            echo "=== duplicated code ==="
            gate pylint --disable=all --enable=duplicate-code --min-similarity-lines=4 app.py tests/*.py

            echo "=== radon: complexity and maintainability ratings (A best, F worst) ==="
            radon cc app.py -s -a || true
            radon mi app.py -s || true
            gate xenon --max-absolute C --max-modules B --max-average B app.py

            echo "=== pytest-cov: test coverage (must be 60% or more) ==="
            gate python -m pytest --cov=app --cov-report=term --cov-report=xml:coverage.xml --junitxml=junit.xml --cov-fail-under=60 -q

            echo "=== hadolint: Dockerfile best practices ==="
            gate sh -c 'docker run --rm -i hadolint/hadolint < Dockerfile'

            if [ "$ENABLE_SEMGREP" = "true" ]; then
              echo "=== semgrep: security rules for many languages ==="
              pip install --quiet semgrep
              gate semgrep scan --config p/python --metrics off --error app.py
            fi

            echo "=================================================="
            if [ "$GATE_FAILED" = "1" ]; then
              echo "QUALITY GATE: FAILED (enforced: $GATE_ENFORCE)"
            else
              echo "QUALITY GATE: PASSED"
            fi
            echo "=================================================="
            if [ "$GATE_FAILED" = "1" ] && [ "$GATE_ENFORCE" = "true" ]; then
              exit 1
            fi
          '''
        }
      }
      post {
        always {
          // Dashboard and history inside Jenkins. Needs the plugins "Warnings Next Generation" and "Coverage";
          // if a plugin is missing, this block is skipped and the pipeline continues.
          catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
            junit allowEmptyResults: true, testResults: 'app/junit.xml'
            recordIssues enabledForFailure: true, tools: [pyLint(pattern: 'app/pylint.txt'), flake8(pattern: 'app/flake8.txt')]
            recordCoverage tools: [[parser: 'COBERTURA', pattern: 'app/coverage.xml']]
          }
        }
      }
    }

    stage('Build Docker image') {
      steps {
        dir('app') {
          sh "docker build --build-arg APP_VERSION=${IMAGE_TAG} -t ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG} ."
        }
      }
    }

    stage('Image vulnerability scan (Trivy)') {
      when { expression { env.ENABLE_TRIVY == 'true' } }
      steps {
        catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
          sh "docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --severity HIGH,CRITICAL --no-progress --exit-code 0 ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
        }
      }
    }

    stage('Push to registry') {
      steps {
        withCredentials([usernamePassword(credentialsId: REGISTRY_CREDS, usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
          sh '''
            echo "$REG_PASS" | docker login -u "$REG_USER" --password-stdin
            docker push ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
          '''
        }
      }
    }

    stage('Update Kubernetes config in Git') {
      steps {
        withCredentials([usernamePassword(credentialsId: GIT_CREDS, usernameVariable: 'GIT_USER', passwordVariable: 'GIT_PASS')]) {
          sh '''
            rm -rf k8s-config
            git clone https://${GIT_USER}:${GIT_PASS}@${K8S_REPO} k8s-config
            cd k8s-config
            sed -i "s|image: .*/poc-web:.*|image: ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}|" deployment.yaml
            git config user.email "jenkins@poc.local"
            git config user.name  "Jenkins"
            git add deployment.yaml
            git commit -m "Deploy ${IMAGE_NAME}:${IMAGE_TAG}"
            git push origin main
          '''
        }
      }
    }
  }

  post {
    always  { sh 'docker logout || true' }
    success { echo "Image ${IMAGE_TAG} pushed; Argo CD will sync it to the cluster." }
  }
}
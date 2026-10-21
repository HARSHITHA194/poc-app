// Declarative pipeline matching the POC workflow:
// GitHub webhook -> Build -> Test -> Security/quality -> Docker image -> Registry
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
  }

  triggers {
    pollSCM('* * * * *')   // fired by the GitHub webhook -> http://<jenkins>/github-webhook/
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
          // Dependency + static analysis (non-blocking for the POC; remove "|| true" to enforce)
          sh '''
            . .venv/bin/activate
            pip install bandit pip-audit flake8
            bandit -r app.py || true
            pip-audit -r requirements.txt || true
            flake8 app.py --max-line-length=120 || true
          '''
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

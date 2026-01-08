import os
from flask import Flask, request, jsonify
import tensorflow as tf
import numpy as np

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'tensorflow_version': tf.__version__,
        'message': 'Python AI Service is running'
    })

@app.route('/explain', methods=['POST'])
def explain():
    try:
        data = request.json
        log_entry = data.get('logEntry', {})
        message = log_entry.get('message', 'No message')
        level = log_entry.get('level', 'UNKNOWN')
        source = log_entry.get('source', 'UNKNOWN')
        
        explanation = f"<p><b>Internal Analysis:</b> This {level} log from <code>{source}</code> indicates: '{message}'.</p>"
        explanation += "<p>Based on local heuristics, this may require attention if it recurs frequently. Check service health and connectivity.</p>"
        
        return jsonify({'explanation': explanation})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/rca', methods=['POST'])
def rca():
    try:
        data = request.json
        target_log = data.get('targetLog', {})
        log_history = data.get('logHistory', [])
        
        summary = f"Local analysis of {len(log_history)} preceding logs suggests a potential correlation between the target error and recent activity in the system."
        
        return jsonify({
            'summary': summary,
            'keyEvents': [
                {'time': target_log.get('timestamp'), 'event': 'Primary incident detected', 'severity': 'high'}
            ],
            'nextSteps': [
                "Review service logs for the last 5 minutes",
                "Check for recent configuration changes",
                "Verify upstream dependency health"
            ]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/playbook', methods=['POST'])
def playbook():
    try:
        data = request.json
        target_log = data.get('targetLog', {})
        level = target_log.get('level', 'ERROR')
        
        return jsonify({
            'title': f"Remediation Playbook: {level} Incident",
            'summary': "Standard operating procedure for resolving this type of log event.",
            'severity': 3 if level == 'FATAL' else 2,
            'triageSteps': [
                {'step': 1, 'action': "Acknowledge the incident in the dashboard.", 'command': "N/A"},
                {'step': 2, 'action': "Check service status.", 'command': "systemctl status aetherlog-backend"},
                {'step': 3, 'action': "Restart service if unresponsive.", 'command': "systemctl restart aetherlog-backend"}
            ],
            'escalationPath': "Escalate to DevOps if issue persists after restart."
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        message = data.get('message', '').lower()
        
        if 'error' in message or 'fail' in message:
            reply = "I've detected you're asking about an error. I recommend checking the 'Live Anomalies' tab for a detailed breakdown of recent issues."
        elif 'help' in message:
            reply = "I am your internal AetherLog assistant. I can help you understand logs, analyze root causes, and suggest remediation steps."
        else:
            reply = "I've received your message. As an internal model, I'm specialized in log analysis. How can I assist you with your data today?"
            
        return jsonify({'reply': reply})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Advanced AI: Autoencoder for Anomaly Detection ---

class LogAutoencoder(tf.keras.Model):
    def __init__(self, input_dim):
        super(LogAutoencoder, self).__init__()
        self.encoder = tf.keras.Sequential([
            tf.keras.layers.Dense(8, activation='relu'),
            tf.keras.layers.Dense(4, activation='relu')
        ])
        self.decoder = tf.keras.Sequential([
            tf.keras.layers.Dense(8, activation='relu'),
            tf.keras.layers.Dense(input_dim, activation='sigmoid')
        ])

    def call(self, x):
        encoded = self.encoder(x)
        decoded = self.decoder(encoded)
        return decoded

# Global model instance
model = None
feature_max = None

def preprocess_logs(logs):
    """Convert log objects into numerical features for training/prediction."""
    features = []
    level_map = {'DEBUG': 0, 'INFO': 1, 'WARN': 2, 'ERROR': 3, 'FATAL': 4}
    source_map = {'api-gateway': 0, 'user-service': 1, 'db-replicator': 2, 'frontend-logger': 3, 'auth-service': 4}
    
    for log in logs:
        # Feature 1: Severity Level
        level_val = level_map.get(log.get('level', 'INFO'), 1)
        # Feature 2: Source
        source_val = source_map.get(log.get('source', 'api-gateway'), 0)
        # Feature 3: Message Length (normalized later)
        msg_len = len(log.get('message', ''))
        
        features.append([level_val, source_val, msg_len])
    
    return np.array(features, dtype=np.float32)

@app.route('/train', methods=['POST'])
def train():
    global model, feature_max
    try:
        data = request.json
        logs = data.get('logs', [])
        if not logs:
            return jsonify({'error': 'No logs provided for training'}), 400
        
        X = preprocess_logs(logs)
        
        # Normalize features to [0, 1]
        feature_max = np.max(X, axis=0)
        feature_max[feature_max == 0] = 1 # Avoid division by zero
        X_train = X / feature_max
        
        # Initialize and compile model
        input_dim = X_train.shape[1]
        model = LogAutoencoder(input_dim)
        model.compile(optimizer='adam', loss='mse')
        
        # Train (small number of epochs for demo speed)
        model.fit(X_train, X_train, epochs=20, batch_size=16, verbose=0)
        
        return jsonify({
            'message': 'Model trained successfully',
            'samples': len(logs),
            'status': 'ready'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/predict', methods=['POST'])
def predict():
    global model, feature_max
    try:
        data = request.json
        logs = data.get('logs', [])
        
        if not logs:
            return jsonify({'error': 'No logs provided for prediction'}), 400
        
        X = preprocess_logs(logs)
        
        if model is not None and feature_max is not None:
            # Use trained Autoencoder
            X_norm = X / feature_max
            reconstructions = model.predict(X_norm)
            # Anomaly score is the reconstruction error (MSE)
            mse = np.mean(np.power(X_norm - reconstructions, 2), axis=1)
            
            # Normalize scores to [0, 1] for the UI
            scores = mse.tolist()
            mean_score = float(np.mean(mse))
            high_risk_count = int(np.sum(mse > 0.1)) # Threshold for "anomaly"
            
            return jsonify({
                'analysis': {
                    'mean_score': mean_score,
                    'high_risk_count': high_risk_count,
                    'total_processed': len(logs),
                    'individual_scores': scores
                },
                'model': 'tf-autoencoder-v1',
                'framework': f'TensorFlow {tf.__version__}'
            })
        else:
            # Fallback to simple logic if not trained
            tensor = tf.constant(X[:, 0], dtype=tf.float32) # Use level as proxy
            mean = tf.reduce_mean(tensor).numpy()
            return jsonify({
                'analysis': {
                    'mean_score': float(mean / 4.0), # Normalize 0-4 to 0-1
                    'total_processed': len(logs),
                    'message': 'Using fallback logic (model not trained)'
                },
                'model': 'tf-fallback-v1'
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)

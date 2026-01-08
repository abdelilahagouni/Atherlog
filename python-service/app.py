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

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        # Expecting 'input' to be a list of numbers (e.g., anomaly scores)
        input_data = data.get('input', [])
        
        if not isinstance(input_data, list):
             # Handle single value case for backward compatibility
             input_data = [input_data]

        if not input_data:
            return jsonify({'error': 'No input data provided'}), 400

        # Convert to TensorFlow tensor
        tensor = tf.constant(input_data, dtype=tf.float32)
        
        # Perform TensorFlow operations
        mean = tf.reduce_mean(tensor).numpy()
        variance = tf.math.reduce_variance(tensor).numpy()
        
        # Mock classification: "High Risk" if value > 0.8
        high_risk_count = tf.reduce_sum(tf.cast(tensor > 0.8, tf.float32)).numpy()
        
        return jsonify({
            'analysis': {
                'mean_score': float(mean),
                'variance': float(variance),
                'high_risk_count': int(high_risk_count),
                'total_processed': len(input_data)
            },
            'model': 'tf-anomaly-detector-v1',
            'framework': f'TensorFlow {tf.__version__}'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)

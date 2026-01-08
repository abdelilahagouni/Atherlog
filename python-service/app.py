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

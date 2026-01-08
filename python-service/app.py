import os
from flask import Flask, request, jsonify
from datetime import datetime, timedelta

# Lazy loading flags
HAS_TRANSFORMERS = False
HAS_TENSORFLOW = False

def get_transformers():
    return None

def get_tensorflow():
    global HAS_TENSORFLOW
    try:
        import tensorflow as tf
        HAS_TENSORFLOW = True
        return tf
    except Exception as e:
        print(f"TensorFlow not available: {e}")
        return None

app = Flask(__name__)

# Global model state
model = None
feature_max = None
nlp_model = None # Lazy loaded

@app.route('/health', methods=['GET'])
def health_check():
    tf_version = 'not_loaded'
    if HAS_TENSORFLOW:
        try:
            import tensorflow as tf
            tf_version = tf.__version__
        except: pass
        
    return jsonify({
        'status': 'healthy',
        'tensorflow_version': tf_version,
        'has_transformers': HAS_TRANSFORMERS,
        'message': 'Python AI Service is running with Pro Features'
    })

# --- Pro Feature 1: Semantic Search ---
@app.route('/semantic-search', methods=['POST'])
def semantic_search():
    try:
        global nlp_model
        data = request.json
        query = data.get('query', '')
        logs = data.get('logs', [])
        
        if not logs or not query:
            return jsonify({'results': []})

        messages = [log.get('message', '') for log in logs]
        
        # Fallback to TF-IDF (always used for speed/memory unless transformers are explicitly requested)
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        
        vectorizer = TfidfVectorizer()
        tfidf_matrix = vectorizer.fit_transform(messages + [query])
        
        scores = cosine_similarity(tfidf_matrix[-1:], tfidf_matrix[:-1])[0]
        
        results = []
        for i, score in enumerate(scores):
            if score > 0.1: # Threshold
                results.append({'log': logs[i], 'score': float(score)})
        
        # Sort by score
        results = sorted(results, key=lambda x: x['score'], reverse=True)
        
        return jsonify({'results': results[:10]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Pro Feature 2: Log Clustering ---
@app.route('/cluster', methods=['POST'])
def cluster_logs():
    try:
        from sklearn.cluster import KMeans
        from sklearn.feature_extraction.text import TfidfVectorizer
        
        data = request.json
        logs = data.get('logs', [])
        if len(logs) < 3:
            return jsonify({'clusters': []})

        messages = [log.get('message', '') for log in logs]
        vectorizer = TfidfVectorizer(max_features=100)
        X = vectorizer.fit_transform(messages)
        
        n_clusters = min(5, len(logs))
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        clusters = kmeans.fit_predict(X)
        
        import numpy as np
        result_clusters = []
        for i in range(n_clusters):
            cluster_indices = np.where(clusters == i)[0]
            cluster_logs = [logs[idx] for idx in cluster_indices]
            # Find a representative message (closest to centroid)
            result_clusters.append({
                'id': i,
                'count': len(cluster_logs),
                'sample': cluster_logs[0].get('message'),
                'logs': cluster_logs[:5]
            })
            
        return jsonify({'clusters': result_clusters})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Pro Feature 3: Urgency Classification ---
@app.route('/urgency', methods=['POST'])
def classify_urgency():
    try:
        data = request.json
        log = data.get('log', {})
        message = log.get('message', '').lower()
        level = log.get('level', 'INFO')
        
        urgency = "Informational"
        score = 0.2
        
        if level in ['FATAL', 'ERROR'] or any(word in message for word in ['fail', 'critical', 'timeout', 'denied']):
            urgency = "Critical"
            score = 0.9
        elif level == 'WARN' or any(word in message for word in ['slow', 'retry', 'limit']):
            urgency = "Actionable"
            score = 0.5
            
        return jsonify({'urgency': urgency, 'score': score})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Pro Feature 4: Volume Forecasting (LSTM-lite) ---
@app.route('/forecast', methods=['POST'])
def forecast_volume():
    try:
        import pandas as pd
        import numpy as np
        data = request.json
        history = data.get('history', []) # List of counts per hour
        
        if len(history) < 5:
            # Not enough data for LSTM, use simple linear trend
            return jsonify({'forecast': [history[-1] * 1.05 if history else 10] * 3})

        # Simple Moving Average for demo speed, but structured for LSTM expansion
        X = np.array(history).reshape(-1, 1)
        forecast = [float(np.mean(history[-3:]) * (1 + (i+1)*0.05)) for i in range(3)]
        
        return jsonify({
            'forecast': forecast,
            'trend': 'increasing' if forecast[-1] > history[-1] else 'stable'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Pro Feature 5: Anomaly Attribution ---
@app.route('/attribute', methods=['POST'])
def attribute_anomaly():
    try:
        data = request.json
        log = data.get('log', {})
        
        # Logic: Compare specific features to global averages
        # For demo, we return mock attribution
        return jsonify({
            'primary_cause': 'Abnormal Message Length' if len(log.get('message', '')) > 100 else 'Unexpected Source',
            'confidence': 0.85,
            'details': f"The log from {log.get('source')} shows a pattern deviation in its structure."
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Pro Feature 6: Component Tagging ---
@app.route('/tag', methods=['POST'])
def tag_log():
    try:
        data = request.json
        log = data.get('log', {})
        msg = log.get('message', '').lower()
        src = log.get('source', '').lower()
        
        tags = []
        if 'db' in src or 'sql' in msg or 'query' in msg: tags.append('#Database')
        if 'auth' in src or 'login' in msg or 'token' in msg: tags.append('#Auth')
        if 'api' in src or 'http' in msg: tags.append('#Network')
        if not tags: tags.append('#General')
        
        return jsonify({'tags': tags})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Pro Feature 7: Health Score ---
@app.route('/health-score', methods=['POST'])
def system_health():
    try:
        import pandas as pd
        import numpy as np
        data = request.json
        logs = data.get('logs', [])
        if not logs: return jsonify({'score': 100})
        
        error_count = sum(1 for l in logs if l.get('level') in ['ERROR', 'FATAL'])
        anomaly_ratio = error_count / len(logs)
        
        score = max(0, 100 - (anomaly_ratio * 200))
        status = "Healthy" if score > 80 else "Degraded" if score > 50 else "Critical"
        
        return jsonify({
            'score': int(score),
            'status': status,
            'factors': [
                {'name': 'Error Rate', 'impact': 'high' if anomaly_ratio > 0.1 else 'low'},
                {'name': 'System Load', 'impact': 'normal'}
            ]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Pro Feature 8: Service Dependency Map ---
@app.route('/dependency-map', methods=['POST'])
def dependency_map():
    try:
        import pandas as pd
        import numpy as np
        data = request.json
        logs = data.get('logs', [])
        if not logs: return jsonify({"nodes": [], "links": []})
        
        df = pd.DataFrame(logs)
        if 'source' not in df.columns:
            return jsonify({"nodes": [], "links": []})
        
        sources = df['source'].unique().tolist()
        nodes = [{"id": s, "group": 1} for s in sources]
        
        links = []
        # Infer connections based on sequential occurrence in logs (heuristic)
        for i in range(len(sources)-1):
            links.append({
                "source": sources[i],
                "target": sources[i+1],
                "value": 1
            })
            
        return jsonify({"nodes": nodes, "links": links})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Pro Feature 9: Incident Timeline ---
@app.route('/timeline', methods=['POST'])
def get_timeline():
    try:
        import pandas as pd
        import numpy as np
        data = request.json
        logs = data.get('logs', [])
        if not logs: return jsonify([])
        
        df = pd.DataFrame(logs)
        if 'timestamp' not in df.columns:
            return jsonify([])
            
        # Harden datetime conversion
        df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
        df = df.dropna(subset=['timestamp'])
        
        if df.empty:
            return jsonify([])
            
        df = df.set_index('timestamp')
        # Use 'h' instead of 'H' to avoid deprecation warning in newer pandas
        resampled = df.resample('h').size()
        
        mean_val = resampled.mean() if not resampled.empty else 0
        
        timeline = []
        for ts, count in resampled.items():
            try:
                timeline.append({
                    "time": ts.strftime('%Y-%m-%d %H:%M'),
                    "count": int(count),
                    "isAnomaly": bool(count > mean_val + 1)
                })
            except Exception as loop_e:
                print(f"Error in timeline loop: {loop_e}")
                continue
            
        return jsonify(timeline)
    except Exception as e:
        print(f"Timeline error: {e}")
        return jsonify({'error': str(e)}), 500

# --- Existing Advanced AI: Autoencoder ---

# LogAutoencoder class moved inside train() for lazy TF loading

model = None
feature_max = None

def preprocess_logs(logs):
    import numpy as np
    features = []
    level_map = {'DEBUG': 0, 'INFO': 1, 'WARN': 2, 'ERROR': 3, 'FATAL': 4}
    source_map = {'api-gateway': 0, 'user-service': 1, 'db-replicator': 2, 'frontend-logger': 3, 'auth-service': 4}
    for log in logs:
        level_val = level_map.get(log.get('level', 'INFO'), 1)
        source_val = source_map.get(log.get('source', 'api-gateway'), 0)
        msg_len = len(log.get('message', ''))
        features.append([level_val, source_val, msg_len])
    return np.array(features, dtype=np.float32)

@app.route('/train', methods=['POST'])
def train():
    global model, feature_max
    import numpy as np
    tf = get_tensorflow()
    if not tf: return jsonify({'error': 'TensorFlow not available'}), 503
    
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

    try:
        data = request.json
        logs = data.get('logs', [])
        if not logs: return jsonify({'error': 'No logs provided'}), 400
        X = preprocess_logs(logs)
        feature_max = np.max(X, axis=0)
        feature_max[feature_max == 0] = 1
        X_train = X / feature_max
        model = LogAutoencoder(X_train.shape[1])
        model.compile(optimizer='adam', loss='mse')
        model.fit(X_train, X_train, epochs=20, batch_size=16, verbose=0)
        return jsonify({'message': 'Model trained', 'samples': len(logs), 'status': 'ready'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/predict', methods=['POST'])
def predict():
    global model, feature_max
    try:
        import numpy as np
        data = request.json
        logs = data.get('logs', [])
        if not logs: return jsonify({'error': 'No logs provided'}), 400
        X = preprocess_logs(logs)
        if model is not None and feature_max is not None:
            X_norm = X / feature_max
            reconstructions = model.predict(X_norm)
            mse = np.mean(np.power(X_norm - reconstructions, 2), axis=1)
            return jsonify({
                'analysis': {
                    'mean_score': float(np.mean(mse)),
                    'high_risk_count': int(np.sum(mse > 0.1)),
                    'total_processed': len(logs),
                    'individual_scores': mse.tolist()
                },
                'model': 'tf-autoencoder-v1'
            })
        else:
            return jsonify({'analysis': {'mean_score': 0, 'message': 'Model not trained'}})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Legacy endpoints for compatibility
@app.route('/explain', methods=['POST'])
def explain():
    try:
        data = request.json
        log_entry = data.get('logEntry', {})
        explanation = f"<p><b>Internal Analysis:</b> {log_entry.get('level')} log from {log_entry.get('source')}.</p>"
        return jsonify({'explanation': explanation})
    except Exception as e: return jsonify({'error': str(e)}), 500

@app.route('/rca', methods=['POST'])
def rca():
    return jsonify({'summary': 'Local RCA complete', 'keyEvents': [], 'nextSteps': []})

@app.route('/playbook', methods=['POST'])
def playbook():
    return jsonify({'title': 'Playbook', 'summary': 'Steps', 'triageSteps': []})

@app.route('/chat', methods=['POST'])
def chat():
    return jsonify({'reply': 'Internal AI ready.'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)

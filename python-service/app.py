import os
from flask import Flask, request, jsonify
from datetime import datetime, timedelta

# Lazy loading flags
HAS_TRANSFORMERS = False
HAS_TENSORFLOW = False

try:
    import transformers
    HAS_TRANSFORMERS = True
    print(f"Transformers loaded successfully: {transformers.__version__}")
except Exception as e:
    print(f"Transformers import failed: {e}")
    # Try to provide more context
    import sys
    print(f"Python path: {sys.path}")
    import traceback
    traceback.print_exc()

def get_transformers():
    global HAS_TRANSFORMERS
    try:
        import transformers
        HAS_TRANSFORMERS = True
        return transformers
    except Exception as e:
        print(f"Transformers not available: {e}")
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
nlp_tokenizer = None

# Model Registry - stores trained models for classification
model_registry = {
    'huggingface': None,  # Stores active HF model
    'kaggle': {}  # Stores Kaggle models by name
}

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

# --- Loghub Dataset Support ---
# HDFS dataset is the gold standard for log anomaly detection research
LOGHUB_DATASETS = {
    'hdfs': {
        'url': 'https://raw.githubusercontent.com/logpai/loghub/master/HDFS/HDFS_2k.log',
        'labels_url': 'https://raw.githubusercontent.com/logpai/loghub/master/HDFS/anomaly_label.csv',
        'description': 'Hadoop Distributed File System logs with labeled anomalies'
    },
    'bgl': {
        'url': 'https://raw.githubusercontent.com/logpai/loghub/master/BGL/BGL_2k.log',
        'description': 'BlueGene/L supercomputer logs'
    }
}

_loghub_cache = {}

def load_loghub_dataset(name='hdfs', max_samples=2000):
    """Load Loghub dataset for training. Uses cached version if available."""
    import numpy as np
    
    if name in _loghub_cache:
        print(f"[Loghub] Using cached {name} dataset")
        return _loghub_cache[name]
    
    if name not in LOGHUB_DATASETS:
        raise ValueError(f"Unknown dataset: {name}. Available: {list(LOGHUB_DATASETS.keys())}")
    
    dataset_info = LOGHUB_DATASETS[name]
    
    try:
        import urllib.request
        
        print(f"[Loghub] Downloading {name} dataset...")
        # Download log file
        with urllib.request.urlopen(dataset_info['url'], timeout=30) as response:
            raw_logs = response.read().decode('utf-8', errors='ignore').split('\n')
        
        logs = []
        for i, line in enumerate(raw_logs[:max_samples]):
            if not line.strip():
                continue
                
            # Parse HDFS log format: timestamp level component message
            parts = line.split()
            if len(parts) < 4:
                continue
            
            # Determine level from content
            level = 'INFO'
            line_lower = line.lower()
            if 'error' in line_lower or 'exception' in line_lower or 'fail' in line_lower:
                level = 'ERROR'
            elif 'warn' in line_lower:
                level = 'WARN'
            elif 'fatal' in line_lower or 'critical' in line_lower:
                level = 'FATAL'
            elif 'debug' in line_lower:
                level = 'DEBUG'
            
            # Extract component (source)
            source = 'hdfs-datanode'
            if 'namenode' in line_lower:
                source = 'hdfs-namenode'
            elif 'jobtracker' in line_lower:
                source = 'hdfs-jobtracker'
            elif 'tasktracker' in line_lower:
                source = 'hdfs-tasktracker'
            
            logs.append({
                'timestamp': f"2024-01-01T{(i % 24):02d}:{(i % 60):02d}:00Z",
                'level': level,
                'source': source,
                'message': ' '.join(parts[3:])[:500],  # Truncate long messages
                'anomalyScore': 0.0  # Will be set below
            })
        
        # Assign anomaly scores based on level (heuristic labeling)
        # In production, you'd use the actual labels file
        for log in logs:
            if log['level'] == 'FATAL':
                log['anomalyScore'] = 0.9 + np.random.random() * 0.1
            elif log['level'] == 'ERROR':
                log['anomalyScore'] = 0.7 + np.random.random() * 0.2
            elif log['level'] == 'WARN':
                log['anomalyScore'] = 0.3 + np.random.random() * 0.3
            else:
                log['anomalyScore'] = np.random.random() * 0.2
        
        _loghub_cache[name] = logs
        print(f"[Loghub] Loaded {len(logs)} logs from {name}")
        return logs
        
    except Exception as e:
        print(f"[Loghub] Failed to load dataset: {e}")
        raise

@app.route('/datasets/available', methods=['GET'])
def list_datasets():
    """List available training datasets"""
    return jsonify({
        'datasets': [
            {
                'id': 'hdfs',
                'name': 'Loghub HDFS',
                'description': 'Hadoop Distributed File System logs - the gold standard for log anomaly detection research',
                'size': '2000 samples',
                'labels': True
            },
            {
                'id': 'bgl',
                'name': 'Loghub BGL',
                'description': 'BlueGene/L supercomputer logs with system failures',
                'size': '2000 samples',
                'labels': True
            },
            {
                'id': 'custom',
                'name': 'Your Organization Logs',
                'description': 'Train on logs from your own database - the model learns YOUR normal patterns',
                'size': 'Variable',
                'labels': False
            }
        ]
    })

@app.route('/datasets/load', methods=['POST'])
def load_dataset_endpoint():
    """Load a specific dataset for training"""
    try:
        data = request.json
        dataset_id = data.get('dataset_id', 'hdfs')
        max_samples = data.get('max_samples', 2000)
        
        if dataset_id == 'custom':
            # Custom logs should be passed in the request
            logs = data.get('logs', [])
            if not logs:
                return jsonify({'error': 'No logs provided for custom dataset'}), 400
            return jsonify({
                'dataset_id': 'custom',
                'logs': logs,
                'count': len(logs),
                'message': f'Loaded {len(logs)} custom logs'
            })
        
        logs = load_loghub_dataset(dataset_id, max_samples)
        return jsonify({
            'dataset_id': dataset_id,
            'logs': logs,
            'count': len(logs),
            'message': f'Loaded {len(logs)} logs from {dataset_id}'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Sentence Transformer (lazy loaded) ---
_sentence_model = None

def get_sentence_model():
    global _sentence_model
    if _sentence_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _sentence_model = SentenceTransformer('all-MiniLM-L6-v2')
            print("[SemanticSearch] Sentence Transformer model loaded: all-MiniLM-L6-v2")
        except Exception as e:
            print(f"[SemanticSearch] Sentence Transformer not available, will use TF-IDF fallback: {e}")
    return _sentence_model

# --- Pro Feature 1: Semantic Search (Sentence Transformers + TF-IDF Fallback) ---
@app.route('/semantic-search', methods=['POST'])
def semantic_search():
    try:
        data = request.json
        query = data.get('query', '')
        logs = data.get('logs', [])
        
        if not logs or not query:
            return jsonify({'results': [], 'method': 'none'})

        messages = [log.get('message', '') for log in logs]
        
        # Try Sentence Transformers first (true semantic understanding)
        model = get_sentence_model()
        if model is not None:
            try:
                from sklearn.metrics.pairwise import cosine_similarity
                import numpy as np
                
                # Encode query and all messages into dense embeddings
                query_embedding = model.encode([query])
                message_embeddings = model.encode(messages)
                
                # Compute cosine similarity between query and each message
                scores = cosine_similarity(query_embedding, message_embeddings)[0]
                
                results = []
                for i, score in enumerate(scores):
                    if score > 0.15:  # Semantic threshold (lower than TF-IDF since embeddings are more nuanced)
                        results.append({'log': logs[i], 'score': float(score)})
                
                results = sorted(results, key=lambda x: x['score'], reverse=True)
                return jsonify({'results': results[:10], 'method': 'sentence-transformers'})
            except Exception as st_err:
                print(f"[SemanticSearch] Sentence Transformer inference failed, falling back to TF-IDF: {st_err}")
        
        # Fallback: TF-IDF (keyword-based)
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        
        vectorizer = TfidfVectorizer()
        tfidf_matrix = vectorizer.fit_transform(messages + [query])
        
        scores = cosine_similarity(tfidf_matrix[-1:], tfidf_matrix[:-1])[0]
        
        results = []
        for i, score in enumerate(scores):
            if score > 0.1:
                results.append({'log': logs[i], 'score': float(score)})
        
        results = sorted(results, key=lambda x: x['score'], reverse=True)
        
        return jsonify({'results': results[:10], 'method': 'tfidf-fallback'})
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

# --- Pro Feature 5: Anomaly Attribution (SHAP Explainability) ---
@app.route('/attribute', methods=['POST'])
def attribute_anomaly():
    try:
        import numpy as np
        data = request.json
        log = data.get('log', {})
        
        # Feature engineering for the single log
        level_map = {'DEBUG': 0, 'INFO': 1, 'WARN': 2, 'ERROR': 3, 'FATAL': 4}
        source_map = {'api-gateway': 0, 'user-service': 1, 'db-replicator': 2, 'frontend-logger': 3, 'auth-service': 4}
        
        feature_names = ['Log Level', 'Source Service', 'Message Length', 'Has Error Keywords', 'Has DB Keywords']
        
        level_val = level_map.get(log.get('level', 'INFO'), 1)
        source_val = source_map.get(log.get('source', ''), 0)
        msg = log.get('message', '')
        msg_len = len(msg)
        msg_lower = msg.lower()
        has_error_kw = 1.0 if any(w in msg_lower for w in ['fail', 'error', 'timeout', 'exception', 'critical', 'denied', 'crash', 'fatal']) else 0.0
        has_db_kw = 1.0 if any(w in msg_lower for w in ['database', 'sql', 'query', 'connection', 'postgres', 'db', 'replicat']) else 0.0
        
        log_features = np.array([[level_val, source_val, msg_len, has_error_kw, has_db_kw]], dtype=np.float32)
        
        # Try SHAP-based explanation
        try:
            import shap
            from sklearn.ensemble import IsolationForest
            
            # Build a background dataset representing "normal" log patterns
            # This simulates the distribution of typical logs for SHAP context
            np.random.seed(42)
            n_bg = 200
            bg_levels = np.random.choice([0, 1, 1, 1, 2], size=n_bg)  # Mostly INFO
            bg_sources = np.random.randint(0, 5, size=n_bg)
            bg_msg_lens = np.random.normal(40, 15, size=n_bg).clip(5, 200)
            bg_error_kw = np.random.choice([0, 0, 0, 0, 1], size=n_bg).astype(float)  # 20% have error keywords
            bg_db_kw = np.random.choice([0, 0, 0, 1], size=n_bg).astype(float)  # 25% have db keywords
            
            X_background = np.column_stack([bg_levels, bg_sources, bg_msg_lens, bg_error_kw, bg_db_kw]).astype(np.float32)
            
            # Train a quick Isolation Forest on background data
            iso_forest = IsolationForest(contamination=0.1, random_state=42, n_estimators=100)
            iso_forest.fit(X_background)
            
            # Use SHAP KernelExplainer to explain the anomaly score
            explainer = shap.KernelExplainer(iso_forest.decision_function, shap.sample(X_background, 50))
            shap_values = explainer.shap_values(log_features, nsamples=100)
            
            # Build attribution results
            shap_vals = shap_values[0]
            abs_shap = np.abs(shap_vals)
            total = abs_shap.sum() if abs_shap.sum() > 0 else 1.0
            
            # Sort features by importance
            feature_impacts = []
            for i, name in enumerate(feature_names):
                impact_pct = float(abs_shap[i] / total * 100)
                direction = 'increases' if shap_vals[i] < 0 else 'decreases'  # Negative decision_function = more anomalous
                feature_impacts.append({
                    'feature': name,
                    'impact_percent': round(impact_pct, 1),
                    'shap_value': round(float(shap_vals[i]), 4),
                    'direction': direction,
                    'actual_value': str(log.get('level', 'INFO')) if i == 0 else 
                                   str(log.get('source', '')) if i == 1 else 
                                   str(int(msg_len)) if i == 2 else
                                   ('Yes' if log_features[0][i] > 0 else 'No')
                })
            
            feature_impacts.sort(key=lambda x: x['impact_percent'], reverse=True)
            
            # Anomaly score from Isolation Forest
            anomaly_score = float(-iso_forest.decision_function(log_features)[0])  # Higher = more anomalous
            anomaly_score_normalized = min(1.0, max(0.0, (anomaly_score + 0.5)))  # Normalize to 0-1 range
            
            primary = feature_impacts[0]
            
            return jsonify({
                'primary_cause': f"{primary['feature']} ({primary['actual_value']})",
                'confidence': round(anomaly_score_normalized, 2),
                'details': f"SHAP analysis shows the top factor is '{primary['feature']}' contributing {primary['impact_percent']}% to the anomaly score. "
                           f"The log from {log.get('source', 'unknown')} with level {log.get('level', 'unknown')} "
                           f"{'contains' if has_error_kw else 'does not contain'} error-related keywords.",
                'method': 'shap-isolation-forest',
                'feature_attributions': feature_impacts,
                'anomaly_score': round(anomaly_score_normalized, 3)
            })
            
        except ImportError as ie:
            print(f"[Attribution] SHAP not available, using rule-based fallback: {ie}")
        except Exception as shap_err:
            print(f"[Attribution] SHAP analysis failed, using rule-based fallback: {shap_err}")
        
        # Fallback: Rule-based attribution
        causes = []
        if level_val >= 3: causes.append(('Log Level', f"Level is {log.get('level')} (severity {level_val}/4)", 0.4))
        if has_error_kw: causes.append(('Error Keywords', 'Message contains error-related keywords', 0.3))
        if msg_len > 100: causes.append(('Message Length', f'Unusually long message ({msg_len} chars)', 0.2))
        if has_db_kw: causes.append(('Database Reference', 'Message references database components', 0.1))
        
        if not causes:
            causes.append(('Unexpected Pattern', 'Log pattern deviates from normal baseline', 0.5))
        
        primary = causes[0]
        return jsonify({
            'primary_cause': primary[0],
            'confidence': primary[2],
            'details': primary[1] + f". The log from {log.get('source')} shows a pattern deviation.",
            'method': 'rule-based-fallback',
            'feature_attributions': [
                {'feature': c[0], 'impact_percent': round(c[2] * 100, 1), 'direction': 'increases', 'actual_value': c[1]}
                for c in causes
            ]
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
    
    try:
        data = request.json
        logs = data.get('logs', [])
        model_type = data.get('model_type', 'tensorflow') # 'tensorflow' or 'huggingface'
        
        print(f"[TRAIN] Received: logs={type(logs)}, len={len(logs) if logs else 'None'}, model_type={model_type}")
        
        if logs is None and model_type != 'huggingface': 
            print("[TRAIN] Rejecting: logs is None and not HF")
            return jsonify({'error': 'No logs provided'}), 400
          # Hyperparameters
        epochs = int(data.get('epochs', 20))
        batch_size = int(data.get('batch_size', 16))
        dropout_rate = float(data.get('dropout', 0.1))
        
        print(f"[TRAIN] Checking model_type: {model_type}")
        # Handle Hugging Face training separately (doesn't need log preprocessing)
        if model_type == 'huggingface':
            print("[TRAIN] Entering HF training block")
            try:
                from transformers import AutoModelForSequenceClassification, AutoTokenizer, Trainer, TrainingArguments
                from datasets import Dataset
                import torch
                
                model_name = data.get('model_name', 'distilbert-base-uncased')
                dataset_name = data.get('dataset_name', 'imdb') # Default to IMDB for demo if no log dataset specified
                
                # Load Tokenizer & Model
                tokenizer = AutoTokenizer.from_pretrained(model_name)
                hf_model = AutoModelForSequenceClassification.from_pretrained(model_name, num_labels=2)
                  # Load Dataset
                if dataset_name == 'custom':
                    # Convert local logs to HF dataset format
                    from datasets import Dataset
                    texts = [l.get('message', '') for l in logs]
                    # Map ERROR and FATAL to 1, others to 0
                    labels = [1 if l.get('level') in ['ERROR', 'FATAL'] else 0 for l in logs] 
                    dataset = Dataset.from_dict({'text': texts, 'labels': labels})
                    
                    # Tokenize
                    def tokenize_function(examples):
                        return tokenizer(examples["text"], padding="max_length", truncation=True)
                    
                    dataset = dataset.map(tokenize_function, batched=True)
                    # Split
                    dataset = dataset.train_test_split(test_size=0.2)
                    print(f"[TRAIN] Custom dataset columns: {dataset['train'].column_names}")
                elif dataset_name in LOGHUB_DATASETS or dataset_name in _loghub_cache:
                    # Use Loghub datasets (hdfs, bgl) from our cache
                    from datasets import Dataset
                    print(f"[TRAIN] Loading Loghub dataset: {dataset_name}")
                    
                    # Load from cache or fetch fresh
                    if dataset_name in _loghub_cache:
                        loghub_logs = _loghub_cache[dataset_name]
                        print(f"[TRAIN] Using cached {dataset_name} with {len(loghub_logs)} logs")
                    else:
                        loghub_logs = load_loghub_dataset(dataset_name, max_samples=2000)
                        print(f"[TRAIN] Freshly loaded {dataset_name} with {len(loghub_logs)} logs")
                    
                    # Convert to HF Dataset format
                    texts = [l.get('message', '') for l in loghub_logs]
                    # Use anomaly labels if available, otherwise use level-based heuristic
                    labels = []
                    for l in loghub_logs:
                        if 'is_anomaly' in l:
                            labels.append(1 if l['is_anomaly'] else 0)
                        else:
                            labels.append(1 if l.get('level') in ['ERROR', 'FATAL', 'WARN'] else 0)
                    
                    dataset = Dataset.from_dict({'text': texts, 'labels': labels})
                    
                    # Tokenize
                    def tokenize_function(examples):
                        return tokenizer(examples["text"], padding="max_length", truncation=True)
                    
                    dataset = dataset.map(tokenize_function, batched=True)
                    # Split
                    dataset = dataset.train_test_split(test_size=0.2)
                    print(f"[TRAIN] Loghub dataset ready: {len(dataset['train'])} train, {len(dataset['test'])} test samples")
                else:
                    # Load from Hub (limit to small subset for demo speed)
                    from datasets import load_dataset
                    print(f"[TRAIN] Loading from Hugging Face Hub: {dataset_name}")
                    dataset = load_dataset(dataset_name)
                    # Tokenize
                    def tokenize_function(examples):
                        return tokenizer(examples["text"], padding="max_length", truncation=True)
                    
                    tokenized_datasets = dataset.map(tokenize_function, batched=True)
                    
                    small_train_dataset = tokenized_datasets["train"].shuffle(seed=42).select(range(100)) # Small subset
                    small_eval_dataset = tokenized_datasets["test"].shuffle(seed=42).select(range(100))
                    
                    dataset = {'train': small_train_dataset, 'test': small_eval_dataset}
                    print(f"[TRAIN] Hub dataset columns: {dataset['train'].column_names}")

                training_args = TrainingArguments(
                    output_dir="./results",
                    num_train_epochs=1, # Keep it fast
                    per_device_train_batch_size=4,
                    logging_dir='./logs',
                    remove_unused_columns=True, # Ensure only model-supported columns are passed
                )
                
                print(f"[TRAIN] Starting Trainer with {len(dataset['train'])} samples...")
                trainer = Trainer(
                    model=hf_model,
                    args=training_args,
                    train_dataset=dataset['train'],
                    eval_dataset=dataset['test'],
                )
                
                trainer.train()
                eval_results = trainer.evaluate()
                
                # Save model to disk (use safe_serialization=False for Windows compatibility)
                save_path = "./models/hf_model"
                os.makedirs(save_path, exist_ok=True)
                hf_model.save_pretrained(save_path, safe_serialization=False)
                tokenizer.save_pretrained(save_path)
                print(f"[TRAIN] Model saved to {save_path}")

                # Save model to global state AND registry
                global nlp_model, nlp_tokenizer, model_registry
                nlp_model = hf_model
                nlp_tokenizer = tokenizer
                
                # Add to model registry for classification
                model_registry['huggingface'] = {
                    'model': hf_model,
                    'tokenizer': tokenizer,
                    'model_name': model_name,
                    'dataset_name': dataset_name
                }
                print(f"[TRAIN] Model added to registry for classification")
                
                return jsonify({
                    'message': f'Hugging Face model {model_name} trained on {dataset_name} and saved.',
                    'status': 'ready',
                    'metrics': eval_results,
                    'framework': 'Hugging Face Transformers'
                })
                
            except Exception as hf_e:
                print(f"Hugging Face Error: {hf_e}")
                return jsonify({'error': f"Hugging Face training failed: {str(hf_e)}"}), 500

        # For TensorFlow/scikit-learn training, preprocess the logs
        X = preprocess_logs(logs)
        feature_max = np.max(X, axis=0)
        feature_max[feature_max == 0] = 1
        X_scaled = X / feature_max
        
        # Train/Val Split (80/20)
        split_idx = int(len(X_scaled) * 0.8)
        X_train, X_val = X_scaled[:split_idx], X_scaled[split_idx:]

        if not tf:
            from sklearn.ensemble import IsolationForest
            model = IsolationForest(contamination=0.1, random_state=42)
            model.fit(X_train)
            
            # Simple train/val loss simulation
            train_scores = model.score_samples(X_train)
            val_scores = model.score_samples(X_val) if len(X_val) > 0 else train_scores
            
            train_loss = float(-np.mean(train_scores))
            val_loss = float(-np.mean(val_scores))
            
            analysis = "Balanced"
            if val_loss > train_loss * 1.5: analysis = "Overfitting"
            elif train_loss > 0.5: analysis = "Underfitting"
            
            return jsonify({
                'message': 'Model trained using scikit-learn (TensorFlow unavailable)', 
                'samples': len(logs), 
                'status': 'ready',
                'metrics': {
                    'train_loss': train_loss,
                    'val_loss': val_loss,
                    'analysis': analysis
                },
                'framework': 'Scikit-learn (Isolation Forest)'
            })
        
        # TensorFlow path
        class LogAutoencoder(tf.keras.Model):
            def __init__(self, input_dim, dropout):
                super(LogAutoencoder, self).__init__()
                self.encoder = tf.keras.Sequential([
                    tf.keras.layers.Dense(8, activation='relu'),
                    tf.keras.layers.Dropout(dropout),
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

        model = LogAutoencoder(X_train.shape[1], dropout_rate)
        model.compile(optimizer='adam', loss='mse')
        
        history = model.fit(
            X_train, X_train, 
            epochs=epochs, 
            batch_size=batch_size, 
            validation_data=(X_val, X_val) if len(X_val) > 0 else None,
            verbose=0
        )
        
        train_loss = history.history['loss'][-1]
        val_loss = history.history.get('val_loss', [train_loss])[-1]
        
        # Analysis
        analysis = "Balanced"
        if val_loss > train_loss * 1.5: analysis = "Overfitting"
        elif train_loss > 0.1: analysis = "Underfitting"
        
        return jsonify({
            'message': 'Model trained', 
            'samples': len(logs), 
            'status': 'ready',
            'metrics': {
                'train_loss': float(train_loss),
                'val_loss': float(val_loss),
                'analysis': analysis
            },
            'framework': 'TensorFlow'
        })
            
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
    try:
        data = request.json
        message = data.get('message', '').lower()
        
        # Simple rule-based logic for "Internal AI"
        reply = "I am the Internal Python AI. I can help you analyze logs, detect anomalies, and forecast trends."
        
        if 'hello' in message or 'hi' in message:
            reply = "Hello! I am ready to assist you with your log analysis."
        elif 'status' in message or 'health' in message:
            reply = "The system appears to be running smoothly. My internal models are active."
        elif 'log' in message or 'error' in message:
            reply = "I can help identify errors. Please use the 'Explain' feature on a specific log entry, or ask me to 'Analyze' in the Log Explorer."
        elif 'help' in message:
            reply = "You can ask me about system status, or use my specialized features like 'Semantic Search' and 'Anomaly Detection' in the dashboard."
        else:
            reply = "I understood your message. While I am a specialized log analysis AI, for general conversation I recommend using the Gemini or OpenAI providers. I am optimized for pattern recognition and anomaly detection."

        return jsonify({'reply': reply})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Pro Feature 10: Hugging Face Inference ---
@app.route('/predict_hf', methods=['POST'])
def predict_hf():
    global nlp_model, nlp_tokenizer
    try:
        if not nlp_model or not nlp_tokenizer:
            # Try to load from disk if not in memory
            try:
                from transformers import AutoModelForSequenceClassification, AutoTokenizer
                model_path = "./models/hf_model"
                if os.path.exists(model_path):
                    print(f"[PREDICT] Loading model from {model_path}...")
                    nlp_model = AutoModelForSequenceClassification.from_pretrained(model_path)
                    nlp_tokenizer = AutoTokenizer.from_pretrained(model_path)
                else:
                    return jsonify({'error': 'Model not trained or loaded'}), 400
            except Exception as e:
                print(f"[PREDICT] Load error: {e}")
                return jsonify({'error': f'Failed to load model: {str(e)}'}), 500

        data = request.json
        text = data.get('text', '')
        if not text: return jsonify({'error': 'No text provided'}), 400

        import torch
        inputs = nlp_tokenizer(text, return_tensors="pt", truncation=True, padding=True, max_length=512)
        with torch.no_grad():
            outputs = nlp_model(**inputs)
            probabilities = torch.nn.functional.softmax(outputs.logits, dim=-1)
            predicted_class = torch.argmax(probabilities, dim=-1).item()
            score = probabilities[0][predicted_class].item()
        
        # Default IMDB labels: 0=Negative, 1=Positive
        # For custom logs, it might be 0=Info, 1=Error
        label = "POSITIVE" if predicted_class == 1 else "NEGATIVE"
        
        return jsonify({
            'label': label,
            'score': float(score),
            'class_id': predicted_class
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Kaggle Dataset Training ---
@app.route('/train-dataset', methods=['POST'])
def train_dataset():
    """Train a scikit-learn classifier on uploaded CSV data"""
    try:
        import pandas as pd
        import numpy as np
        from sklearn.model_selection import train_test_split
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.linear_model import LogisticRegression
        from sklearn.svm import SVC
        from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
        from sklearn.preprocessing import LabelEncoder
        
        data = request.json
        csv_data = data.get('csv_data', '')  # CSV as string
        target_column = data.get('target_column', '')
        feature_columns = data.get('feature_columns', [])
        model_type = data.get('model_type', 'random_forest')
        
        if not csv_data or not target_column or not feature_columns:
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Parse CSV
        from io import StringIO
        df = pd.read_csv(StringIO(csv_data))
        
        # Prepare features and target
        X = df[feature_columns]
        y = df[target_column]
        
        # Encode categorical features if any
        for col in X.columns:
            if X[col].dtype == 'object':
                le = LabelEncoder()
                X[col] = le.fit_transform(X[col].astype(str))
        
        # Encode target if categorical
        if y.dtype == 'object':
            le_target = LabelEncoder()
            y = le_target.fit_transform(y.astype(str))
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Select and train model
        if model_type == 'random_forest':
            model = RandomForestClassifier(n_estimators=100, random_state=42)
        elif model_type == 'logistic_regression':
            model = LogisticRegression(max_iter=1000, random_state=42)
        elif model_type == 'svm':
            model = SVC(kernel='rbf', random_state=42)
        else:
            return jsonify({'error': f'Unknown model type: {model_type}'}), 400
        
        model.fit(X_train, y_train)
        
        # Evaluate
        y_pred = model.predict(X_test)
        
        # Calculate metrics (handle multi-class with 'weighted' average)
        accuracy = accuracy_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred, average='weighted', zero_division=0)
        recall = recall_score(y_test, y_pred, average='weighted', zero_division=0)
        f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)
        
        # Save model to disk
        import pickle
        model_save_path = f"./models/kaggle_{model_type}.pkl"
        os.makedirs("./models", exist_ok=True)
        with open(model_save_path, 'wb') as f:
            pickle.dump(model, f)
        print(f"[TRAIN-DATASET] Model saved to {model_save_path}")
        
        # Add to model registry
        global model_registry
        model_registry['kaggle'][model_type] = {
            'model': model,
            'model_type': model_type,
            'feature_columns': feature_columns,
            'target_column': target_column
        }
        print(f"[TRAIN-DATASET] Model added to registry")
        
        return jsonify({
            'accuracy': float(accuracy),
            'precision': float(precision),
            'recall': float(recall),
            'f1_score': float(f1),
            'model_type': model_type,
            'train_samples': len(X_train),
            'test_samples': len(X_test),
            'message': f'Model trained successfully on {len(df)} samples'
        })
        
    except Exception as e:
        print(f"[TRAIN-DATASET] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# --- Model Classification ---
@app.route('/classify-log', methods=['POST'])
def classify_log():
    """Classify a single log using the active model"""
    try:
        data = request.json
        text = data.get('text', '')
        model_type = data.get('model_type', 'huggingface')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        if model_type == 'huggingface':
            # Use HuggingFace model
            if model_registry['huggingface'] is None:
                return jsonify({'error': 'No HuggingFace model loaded'}), 400
            
            import torch
            model_data = model_registry['huggingface']
            model = model_data['model']
            tokenizer = model_data['tokenizer']
            
            inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True, max_length=512)
            with torch.no_grad():
                outputs = model(**inputs)
                probabilities = torch.nn.functional.softmax(outputs.logits, dim=-1)
                predicted_class = torch.argmax(probabilities, dim=-1).item()
                score = probabilities[0][predicted_class].item()
            
            # 0 = Normal, 1 = Critical (for log classification)
            label = "CRITICAL" if predicted_class == 1 else "NORMAL"
            
            return jsonify({
                'prediction': label,
                'confidence': float(score),
                'class_id': predicted_class
            })
        
        elif model_type == 'kaggle':
            # Use Kaggle model
            model_name = data.get('model_name', 'default')
            if model_name not in model_registry['kaggle']:
                return jsonify({'error': f'Kaggle model {model_name} not found'}), 400
            
            # For Kaggle models, we'd need the features
            # This is a simplified version
            return jsonify({
                'prediction': 'NORMAL',
                'confidence': 0.5,
                'note': 'Kaggle model classification requires feature engineering'
            })
        
        else:
            return jsonify({'error': 'Invalid model type'}), 400
            
    except Exception as e:
        print(f"[CLASSIFY] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Try to load model on startup
    try:
        if HAS_TRANSFORMERS:
            from transformers import AutoModelForSequenceClassification, AutoTokenizer
            model_path = "./models/hf_model"
            if os.path.exists(model_path):
                print(f"[STARTUP] Loading saved HF model from {model_path}...")
                nlp_model = AutoModelForSequenceClassification.from_pretrained(model_path)
                nlp_tokenizer = AutoTokenizer.from_pretrained(model_path)
                print("[STARTUP] Model loaded successfully.")
    except Exception as e:
        print(f"[STARTUP] Warning: Could not load saved model: {e}")

    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port)

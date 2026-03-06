import os
import sys
import json
import time
import torch
import numpy as np
from pathlib import Path
from sklearn.metrics import confusion_matrix, classification_report
from sklearn.ensemble import IsolationForest
from sklearn.model_selection import train_test_split
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# Add parent dir to path to import from run_experiments
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from run_experiments import load_dataset, extract_features, compute_metrics

def main():
    print("--- AetherLog Hybrid Model Evaluation (Exp 3) ---")
    
    # 1. Dataset Loading (matching Experiment 3 parameters)
    sample_size = 50000
    print(f"Loading BGL dataset (max {sample_size} samples)...")
    texts, labels = load_dataset("bgl", sample_size)
    
    # 2. Re-create the Pool Split (Pool A for Train, Pool B for Eval)
    # Using the same random_state=42 as in run_experiments.py:441
    t_pool_a, t_pool_b, l_pool_a, l_pool_b = train_test_split(
        texts, labels, test_size=0.2, random_state=42, stratify=labels
    )
    print(f"Split completed: Train={len(t_pool_a)}, Test={len(t_pool_b)}")
    
    # 3. Re-train Isolation Forest (Stage 1) on Pool A
    # Matching contamination logic from run_experiments.py:452
    print("Re-training Isolation Forest (Stage 1) on Pool A...")
    X_pool_a = extract_features(t_pool_a)
    actual_anomaly_rate = sum(l_pool_a) / len(l_pool_a)
    contamination = max(0.1, min(0.3, actual_anomaly_rate * 2.5))
    
    iso_forest = IsolationForest(n_estimators=300, contamination=contamination, random_state=42, n_jobs=-1)
    iso_forest.fit(X_pool_a)
    print(f"IF trained with contamination {contamination:.4f}")
    
    # 4. Load Trained DistilBERT Model (Stage 2)
    model_path = Path(__file__).parent / "models" / "hf_model"
    if not model_path.exists():
        # Try relative to root if service dir doesn't have it
        model_path = Path(__file__).parent.parent / "models" / "hf_model"
        
    print(f"Loading DistilBERT from {model_path}...")
    tokenizer = AutoTokenizer.from_pretrained(str(model_path))
    hf_model = AutoModelForSequenceClassification.from_pretrained(str(model_path))
    hf_model.eval()
    
    if torch.cuda.is_available():
        hf_model.cuda()
        print("Using GPU for inference")
    else:
        print("Using CPU for inference")
        
    # 5. Hybrid Inference on Pool B (Test Set)
    print("Running hybrid inference on BGL Test Set (Pool B)...")
    X_pool_b = extract_features(t_pool_b)
    if_preds_b = iso_forest.predict(X_pool_b)
    
    final_preds = []
    final_scores = []
    
    t0 = time.perf_counter()
    with torch.no_grad():
        for i, pred in enumerate(if_preds_b):
            if pred == -1: # Flagged by Stage 1
                enc = tokenizer(t_pool_b[i], return_tensors="pt", truncation=True, padding=True, max_length=128)
                if torch.cuda.is_available():
                    enc = {k: v.cuda() for k, v in enc.items()}
                
                out = hf_model(**enc)
                prob = torch.softmax(out.logits, dim=-1)[0]
                final_preds.append(int(prob.argmax()))
                final_scores.append(float(prob[1]))
            else: # Filtered by Stage 1 (assumed normal)
                final_preds.append(0)
                final_scores.append(0.0)
                
    inference_time = (time.perf_counter() - t0) * 1000
    print(f"Inference complete in {inference_time:.2f}ms")
    
    # 6. Evaluation Metrics
    cm = confusion_matrix(l_pool_b, final_preds)
    report = classification_report(l_pool_b, final_preds, target_names=["Normal", "Anomaly"], output_dict=True)
    metrics = compute_metrics(l_pool_b, final_preds, final_scores)
    
    # Prepare results for JSON
    results = {
        "dataset": "BGL",
        "test_split": "20% (random_state=42)",
        "num_test_samples": len(t_pool_b),
        "confusion_matrix": cm.tolist(),
        "classification_report": report,
        "metrics": metrics,
        "inference_time_ms": inference_time,
        "ms_per_log": inference_time / len(t_pool_b)
    }
    
    # 7. Output Results
    print("\n" + "="*40)
    print("RESULT: RAW CONFUSION MATRIX")
    print(cm)
    print("="*40)
    print("\nClassification Report:")
    print(classification_report(l_pool_b, final_preds, target_names=["Normal", "Anomaly"]))
    
    output_file = Path(__file__).parent / "confusion_matrix_results.json"
    with open(output_file, "w") as f:
        json.dump(results, f, indent=4)
    print(f"\nResults saved to {output_file}")

if __name__ == "__main__":
    main()

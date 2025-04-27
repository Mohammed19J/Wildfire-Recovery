import os
import numpy as np
import matplotlib.pyplot as plt
from datetime import datetime, timedelta

def logistic_growth(t, N0, K, r):
    return K / (1 + ((K - N0) / N0) * np.exp(-r * t))

# Params
N0, K, r = 0.2, 0.75, 0.5
months = np.arange(0, 50, 1)
predicted_ndvi = logistic_growth(months, N0, K, r)
start_date = datetime.strptime("2020-08-01", "%Y-%m-%d")
dates = [start_date + timedelta(days=30*i) for i in range(len(months))]

# Plot
fig, ax = plt.subplots(figsize=(10, 5))
ax.plot(dates, predicted_ndvi, label="Predicted NDVI", color="green")
ax.set_title("Predicted NDVI Recovery")
ax.set_xlabel("Date")
ax.set_ylabel("NDVI")
ax.grid(True)
ax.legend()
plt.tight_layout()

# Ensure the 'public' directory exists
output_dir = os.path.join(os.path.dirname(__file__), "..", "public")
os.makedirs(output_dir, exist_ok=True)

# Save to public folder
output_path = os.path.join(output_dir, "predicted_ndvi.png")
plt.savefig(output_path)
print(f"Saved to {output_path}")

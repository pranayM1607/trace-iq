import os
import uvicorn

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8001"))
    print(f"Starting TraceIQ Objective 2 Backend on http://127.0.0.1:{port} ...")
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, reload=False)

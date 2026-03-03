from flask import Flask, render_template, request
from utils import extract_text_from_pdf, calculate_similarity
app = Flask(__name__)

@app.route("/", methods=["GET", "POST"])
def home():
    results = None
    if request.method == "POST":
        job_description = request.form.get("job_desc")
        resumes = request.files.getlist("resumes")

        results = []

        for file in resumes:
            resume_text = extract_text_from_pdf(file)
            score = calculate_similarity(job_description, resume_text)

            results.append((file.filename, score))

        results.sort(key=lambda x: x[1], reverse=True)

    return render_template("index.html", results = results)
if __name__ == "__main__":
    app.run(debug=True)
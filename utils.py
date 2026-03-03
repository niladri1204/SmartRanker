import PyPDF2
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

def extract_text_from_pdf(file):
    text = ""
    reader = PyPDF2.PdfReader(file)

    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text

    return text

def calculate_similarity(job_desc, resume_text):
    documents = [job_desc, resume_text]

    tfidf = TfidfVectorizer()
    tfidf_matrix = tfidf.fit_transform(documents)

    similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])

    return similarity[0][0]
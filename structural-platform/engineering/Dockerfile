FROM python:3.12-slim@sha256:a6e34c598f2467ed0e9a8d349809fcd8b5c603269512df273a0bb1784edc11b1
WORKDIR /engine
COPY requirements-test.lock ./
RUN python -m pip install --no-cache-dir -r requirements-test.lock setuptools==82.0.1
COPY . ./
RUN python -m pip install --no-cache-dir --no-deps --no-build-isolation .
CMD ["python", "-m", "structural_engine.sectional_properties"]

FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS core-build
WORKDIR /build
COPY frontend/vue/package.json frontend/vue/package-lock.json ./frontend/vue/
RUN cd frontend/vue && npm ci --no-audit --no-fund
COPY section-properties ./section-properties
COPY scripts/build-section-properties-core.cjs ./scripts/
RUN SECTION_CORE_ONLY=1 node scripts/build-section-properties-core.cjs

FROM python:3.12-slim@sha256:a6e34c598f2467ed0e9a8d349809fcd8b5c603269512df273a0bb1784edc11b1
COPY --from=core-build /usr/local/bin/node /usr/local/bin/node
WORKDIR /engine
COPY engineering/requirements-test.lock ./
RUN python -m pip install --no-cache-dir -r requirements-test.lock setuptools==82.0.1
COPY engineering ./
COPY --from=core-build /build/engineering/structural_engine/sectional_properties/data/section-core.mjs ./structural_engine/sectional_properties/data/section-core.mjs
COPY --from=core-build /build/engineering/structural_engine/sectional_properties/data/section-registry.json ./structural_engine/sectional_properties/data/section-registry.json
RUN python -m pip install --no-cache-dir --no-deps --no-build-isolation .
CMD ["python", "-m", "structural_engine.sectional_properties"]

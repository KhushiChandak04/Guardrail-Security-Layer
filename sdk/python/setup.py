from setuptools import find_packages, setup

setup(
    name="guardrail-sdk",
    version="0.1.0",
    description="Python SDK for Guardrail AI middleware",
    packages=find_packages(),
    install_requires=["httpx>=0.27,<0.29"],
)

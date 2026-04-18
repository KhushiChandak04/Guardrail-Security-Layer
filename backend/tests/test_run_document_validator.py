import os
import sys

sys.path.insert(0, os.path.abspath("backend"))

from app.guardrails.validators.document_validator import scan_document


def run_tests() -> None:
	test_cases = [
		"John Doe Email: john@gmail.com Phone: 9876543210",
		"My Aadhaar is 1234 5678 9012",
		"PAN: ABCDE1234F",
		"Aadhaar 1234 5678 9012 and email a+b@company.com",
		"This is a confidential company report",
		"This is a normal document about AI",
	]

	for text in test_cases:
		print("\nINPUT:", text)
		print("OUTPUT:", scan_document(text))


if __name__ == "__main__":
	run_tests()
from firebase_config import write_test_document


def main() -> None:
    try:
        document_id = write_test_document()
        print(f"Firebase connection successful. Created test/{document_id}")
    except Exception as error:
        print(f"Firebase connection failed: {error}")
        raise


if __name__ == "__main__":
    main()
"""Encryption utilities for securing sensitive data like Cronometer credentials."""

from cryptography.fernet import Fernet

from src.config import get_settings


def _get_fernet() -> Fernet:
    """Get Fernet instance using the encryption key from settings.

    Returns:
        Fernet instance configured with the encryption key.

    Raises:
        ValueError: If CRONOMETER_ENCRYPTION_KEY is not configured.
    """
    settings = get_settings()
    key = settings.CRONOMETER_ENCRYPTION_KEY
    if not key:
        raise ValueError(
            "CRONOMETER_ENCRYPTION_KEY environment variable not set. "
            "Generate a key with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
        )
    return Fernet(key.encode())


def encrypt_string(plaintext: str) -> str:
    """Encrypt a plaintext string using Fernet symmetric encryption.

    Args:
        plaintext: The string to encrypt.

    Returns:
        The encrypted string (base64 encoded).

    Raises:
        ValueError: If encryption key is not configured.
    """
    fernet = _get_fernet()
    encrypted = fernet.encrypt(plaintext.encode())
    return encrypted.decode()


def decrypt_string(ciphertext: str) -> str:
    """Decrypt a ciphertext string using Fernet symmetric encryption.

    Args:
        ciphertext: The encrypted string (base64 encoded).

    Returns:
        The decrypted plaintext string.

    Raises:
        ValueError: If encryption key is not configured.
        cryptography.fernet.InvalidToken: If decryption fails (wrong key or corrupted data).
    """
    fernet = _get_fernet()
    decrypted = fernet.decrypt(ciphertext.encode())
    return decrypted.decode()

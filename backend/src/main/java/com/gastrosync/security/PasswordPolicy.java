package com.gastrosync.security;

/**
 * Sifre politikasi: en az 8 karakter, en az bir harf ve bir rakam.
 */
public final class PasswordPolicy {

    public static final int MIN_LENGTH = 8;
    public static final int MAX_LENGTH = 100;

    private PasswordPolicy() {}

    public static void validate(String password) {
        if (password == null || password.length() < MIN_LENGTH) {
            throw new IllegalArgumentException("Sifre en az " + MIN_LENGTH + " karakter olmalidir");
        }
        if (password.length() > MAX_LENGTH) {
            throw new IllegalArgumentException("Sifre en fazla " + MAX_LENGTH + " karakter olabilir");
        }
        boolean hasLetter = password.chars().anyMatch(Character::isLetter);
        boolean hasDigit = password.chars().anyMatch(Character::isDigit);
        if (!hasLetter || !hasDigit) {
            throw new IllegalArgumentException("Sifre en az bir harf ve bir rakam icermelidir");
        }
        if (password.isBlank() || !password.equals(password.strip())) {
            throw new IllegalArgumentException("Sifre bosluk ile baslayamaz veya bitemez");
        }
    }
}

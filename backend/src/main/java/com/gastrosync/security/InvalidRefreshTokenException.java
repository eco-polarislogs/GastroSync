package com.gastrosync.security;

/** Yenileme token'i gecersiz / suresi dolmus / iptal edilmis: istemci yeniden giris yapmalidir (401) */
public class InvalidRefreshTokenException extends RuntimeException {
    public InvalidRefreshTokenException(String message) {
        super(message);
    }
}

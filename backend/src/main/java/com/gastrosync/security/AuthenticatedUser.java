package com.gastrosync.security;

import java.security.Principal;

/**
 * Dogrulanmis oturum sahibi. Rol bilgisi her istekte veritabanindan okunur;
 * bu sayede yetki degisikligi / hesabin pasife alinmasi aninda etkili olur.
 */
public record AuthenticatedUser(Long id, String username, String name, String role) implements Principal {

    @Override
    public String getName() {
        return username;
    }

    public String displayName() {
        return name != null && !name.isBlank() ? name : username;
    }

    @Override
    public String toString() {
        return username;
    }
}

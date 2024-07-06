/*

(Currently in alpha, version might be unstable)
A JavaScript plugin that makes the use of website cookies easier. The built in 'CookieStore' Web API is still experimental and still not compatible with every browser, so :v.

Version : 0.51a

By CalmBubbles :)

*/

class CookieJar
{
    static GetCookie (name)
    {
        const cookies = document.cookie;
        const cookieList = cookies.split("; ");
        
        for (let i = 0; i < cookieList.length; i++)
        {
            const cookie = cookieList[i];
            const properties = cookie.split("=");
            
            if (properties[0] === name) return decodeURIComponent(properties[1]);
        }
        
        return "";
    }
    
    static SetCookie (name, value, path, expiration)
    {
        let expires = "";
        
        if (expiration != null) expires = `; expires=${expiration.toUTCString()}`;
        
        document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=${path ?? "/"}${expires}`;
    }
    
    static RemoveCookie (name, path)
    {
        this.SetCookie(name, 0, path, new Date(0));
    }
}
<?php\
$f1 = "C:/Users/root/Desktop/APACHEXAMPP/htdocs/Artvaultv3/google-callback.php";\
$c1 = file_get_contents($f1);\
$c1 = str_replace('header("Location: user_page.php");', '\\$_SESSION["email"] = \\$email; header("Location: user_page.php");', $c1);\
file_put_contents($f1, $c1);\
\
$f2 = "C:/Users/root/Desktop/APACHEXAMPP/htdocs/Artvaultv3/otp-verify.php";\
$c2 = file_get_contents($f2);\
$c2 = str_replace('header("Location: user_page.php");', '\\$_SESSION["email"] = \\$user["email"]; header("Location: user_page.php");', $c2);\
file_put_contents($f2, $c2);\
\
echo "patched successfully";\
?>

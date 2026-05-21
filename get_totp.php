<?php
require_once 'TotpAuthenticator.php';
echo TotpAuthenticator::getCode($_GET['secret'] ?? 'JBSWY3DPEHPK3PXP');

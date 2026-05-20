<?php

// SQLite Database File Path
$db_file = __DIR__ . '/artvault.sqlite';

class SQLiteResultWrapper {
    private $rows = [];
    private $currentIndex = 0;
    public $num_rows = 0;

    public function __construct($pdoStatement) {
        if ($pdoStatement) {
            $this->rows = $pdoStatement->fetchAll(PDO::FETCH_ASSOC);
            $this->num_rows = count($this->rows);
        }
    }

    public function fetch_assoc() {
        if ($this->currentIndex < $this->num_rows) {
            return $this->rows[$this->currentIndex++];
        }
        return null;
    }

    public function fetch_array() {
        if ($this->currentIndex < $this->num_rows) {
            $row = $this->rows[$this->currentIndex++];
            $arr = [];
            $i = 0;
            foreach ($row as $k => $v) {
                $arr[$k] = $v;
                $arr[$i++] = $v;
            }
            return $arr;
        }
        return null;
    }
}

class SQLiteStatementWrapper {
    private $stmt;
    private $params = [];

    public function __construct($pdoStatement) {
        $this->stmt = $pdoStatement;
    }

    public function bind_param($types, &...$params) {
        $this->params = $params;
        return true;
    }

    public function execute() {
        return $this->stmt->execute($this->params);
    }

    public function get_result() {
        return new SQLiteResultWrapper($this->stmt);
    }

    public function close() {
        return true;
    }
}

class SQLiteDBWrapper {
    private $pdo;
    public $connect_error = null;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    public function query($sql) {
        try {
            $stmt = $this->pdo->query($sql);
            if ($stmt === false) {
                return false;
            }
            if (preg_match('/^\s*(select|show|describe|explain|pragma)/i', $sql)) {
                return new SQLiteResultWrapper($stmt);
            }
            return true;
        } catch (PDOException $e) {
            return false;
        }
    }

    public function prepare($sql) {
        try {
            $stmt = $this->pdo->prepare($sql);
            if ($stmt === false) {
                return false;
            }
            return new SQLiteStatementWrapper($stmt);
        } catch (PDOException $e) {
            return false;
        }
    }

    public function escapeString($str) {
        $quoted = $this->pdo->quote($str);
        return substr($quoted, 1, -1);
    }

    public function close() {
        return true;
    }
}

// Global helper for mysqli compatibility
if (!function_exists('mysqli_real_escape_string')) {
    function mysqli_real_escape_string($conn, $val) {
        if ($conn instanceof SQLiteDBWrapper) {
            return $conn->escapeString($val);
        }
        return addslashes($val);
    }
}

try {
    $pdo = new PDO("sqlite:" . $db_file);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Auto-create Tables if they do not exist
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user'
    )");
    
    $pdo->exec("CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        image_name TEXT DEFAULT NULL,
        description TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )");
    
    // Auto-seed default Administrator if the database is empty
    $count = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
    if ($count == 0) {
        $hash = password_hash('admin123', PASSWORD_BCRYPT);
        $stmt = $pdo->prepare("INSERT INTO users (name, username, email, password, role) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute(['System Admin', 'admin', 'admin@artvault.com', $hash, 'admin']);
    }
    
    $conn = new SQLiteDBWrapper($pdo);
    
} catch (PDOException $e) {
    die("Database connection failed: " . $e->getMessage());
}
?>
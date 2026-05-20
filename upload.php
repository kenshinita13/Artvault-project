<?php

if(isset($_POST['submit'])){

    $target_dir = "uploads/";
    $file_name = basename($_FILES["image"]["name"]);
    $target_file = $target_dir . $file_name;

    $imageFileType = strtolower(pathinfo($target_file, PATHINFO_EXTENSION));

    // allowed file types
    $allowed = array("jpg","jpeg","png","gif");

    if(in_array($imageFileType, $allowed)){

        if(move_uploaded_file($_FILES["image"]["tmp_name"], $target_file)){

            echo "Image uploaded successfully.";

        } else {

            echo "Upload failed.";

        }

    } else {

        echo "Only JPG, PNG, GIF allowed.";

    }

}

if (isset($_POST['upload']) && isset($_FILES['image'])) {

    $fileName = time() . "_" . $_FILES['image']['name']; // avoid duplicates
    $tmpName = $_FILES['image']['tmp_name'];

    $uploadDir = "uploads/";
    $filePath = $uploadDir . $fileName;

    if (move_uploaded_file($tmpName, $filePath)) {

        // ✅ SAVE TO DATABASE
        $conn->query("INSERT INTO images (file_path) VALUES ('$filePath')");

        header("Location: home.php?upload=success");
        exit();
    } else {
        header("Location: home.php?upload=failed");
        exit();
    }
}

?>
<!DOCTYPE html>
<html>
<head>
<title>Upload Photo</title>
</head>

<body>

<h2>Upload Photo</h2>

<form action="upload_process.php" method="POST" enctype="multipart/form-data">

<input type="file" name="image" required>

<br><br>

<button type="submit">Upload</button>

</form>

</body>
</html>
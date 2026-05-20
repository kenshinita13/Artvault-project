<?php

$conn = new mysqli("localhost","root","","images");

if(isset($_FILES['image'])){

    $file_name = $_FILES['image']['name'];
    $file_tmp = $_FILES['image']['tmp_name'];

    $path = "uploads/" . $file_name;

  if(move_uploaded_file($file_tmp,$path)){

    $sql = "INSERT INTO images (image_name,image_path)
            VALUES ('$file_name','$path')";

    $conn->query($sql);

    header("Location: home.php?upload=success");
    exit();

}else{

    header("Location: home.php?upload=failed");
    exit();
}
}

?>